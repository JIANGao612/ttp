import React, {useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo} from 'react';
import {
    Undo2, Redo2, Bold, Italic, Underline, Strikethrough,
    AlignLeft, AlignCenter, AlignRight, Merge, Split,
    Search, Plus, Minus, EyeOff, Eye, Maximize2, Minimize2,
    ChevronsLeftRight, ChevronsUpDown,
} from 'lucide-react';
import {
    cellKey, colIndexToLetter, isInMerge, isMergeOrigin,
    HistoryStack, DEFAULT_FONT_SIZE, DEFAULT_FONT_FAMILY,
    DEFAULT_ROW_HEIGHT, DEFAULT_COL_WIDTH, ROW_HEADER_WIDTH, COL_HEADER_HEIGHT,
} from './types';
import type {CellData, CellStyle, MergeCell} from './types';
import {cn} from '@/lib/utils';
import FindReplaceDialog from './FindReplaceDialog';
import ContextMenu from './ContextMenu';
import {CellSelectionProvider} from './CellSelectionContext';
import {toast} from 'sonner';
import {assertDownloadAllowed} from '@client/src/utils/export-guard';


interface SpreadsheetProps {
    initialRows?: number;
    initialCols?: number;
    initialData?: { row: number; col: number; value: string; style?: CellStyle }[];
    initialMerges?: MergeCell[];
    colWidths?: number[];
    rowHeights?: number[];
    frozenRows?: number;
    frozenCols?: number;
    bottomFrozenRows?: number;
    className?: string;
    hideToolbar?: boolean;
    showAddRows?: boolean;
    initialHiddenCols?: number[];
    initialHiddenRows?: number[];
    onStateChange?: (state: { hiddenCols: number[]; hiddenRows: number[] }) => void;
    onScrollChange?: (scroll: { scrollLeft: number; scrollTop: number }) => void;
    onColumnResizeEnd?: (colWidths: number[]) => void;
    initialScrollLeft?: number;
    initialScrollTop?: number;
}

const FONT_FAMILIES: { label: string; value: string }[] = [
    {label: '飞书默认', value: DEFAULT_FONT_FAMILY},
    {label: 'Arial', value: 'Arial, sans-serif'},
    {label: '微软雅黑', value: '"Microsoft YaHei", sans-serif'},
    {label: '苹方', value: '"PingFang SC", sans-serif'},
    {label: '等线', value: '"DengXian", sans-serif'},
    {label: '宋体', value: '"SimSun", serif'},
    {label: 'Times New Roman', value: '"Times New Roman", serif'},
];
const FONT_SIZES = [10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36];

const Spreadsheet: React.FC<SpreadsheetProps> = ({
                                                     initialRows = 100,
                                                     initialCols = 30,
                                                     initialData = [],
                                                     initialMerges = [],
                                                     colWidths: initialColWidths,
                                                     rowHeights: initialRowHeights,
                                                     hideToolbar = false,
                                                     showAddRows = true,
                                                     frozenRows = 0,
                                                     frozenCols = 0,
                                                     bottomFrozenRows = 0,
                                                     className,
                                                     initialHiddenCols,
                                                     initialHiddenRows,
                                                     onStateChange,
                                                     onScrollChange,
                                                     onColumnResizeEnd,
                                                     initialScrollLeft = 0,
                                                     initialScrollTop = 0,
                                                 }) => {
    const [rows, setRows] = useState(initialRows);
    const [cols] = useState(initialCols);
    const [cells, setCells] = useState<Map<string, CellData>>(() => {
        const m = new Map<string, CellData>();
        for (const d of initialData) {
            m.set(cellKey(d.row, d.col), {value: d.value, style: d.style});
        }
        return m;
    });
    const [merges, setMerges] = useState<MergeCell[]>(initialMerges);
    const [colWidths, setColWidths] = useState<number[]>(
        initialColWidths || Array(initialCols).fill(DEFAULT_COL_WIDTH),
    );
    const [rowHeights, setRowHeights] = useState<number[]>(
        initialRowHeights || Array(initialRows).fill(DEFAULT_ROW_HEIGHT),
    );
    const [zoom, setZoom] = useState(100);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [selection, setSelection] = useState<{ startRow: number; startCol: number; endRow: number; endCol: number }>({
        startRow: 0, startCol: 0, endRow: 0, endCol: 0,
    });
    const [editing, setEditing] = useState<{ row: number; col: number } | null>(null);
    const [editValue, setEditValue] = useState('');
    const [isSelecting, setIsSelecting] = useState(false);
    const [findReplaceOpen, setFindReplaceOpen] = useState(false);
    const [findMode, setFindMode] = useState<'find' | 'replace'>('find');
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const [copiedSelection, setCopiedSelection] = useState(false);
    const [hiddenCols, setHiddenCols] = useState<Set<number>>(
        initialHiddenCols ? new Set(initialHiddenCols) : new Set(),
    );
    const [hiddenRows, setHiddenRows] = useState<Set<number>>(
        initialHiddenRows ? new Set(initialHiddenRows) : new Set(),
    );
    const stateChangeReadyRef = useRef(false);
    const scrollRestoreRef = useRef(false);
    const [selectionMode, setSelectionMode] = useState<'cell' | 'col' | 'row'>('cell');
    const [extraCells, setExtraCells] = useState<Set<string>>(new Set());
    const [anchorCell, setAnchorCell] = useState<{ row: number; col: number } | null>(null);
    const [headerMenu, setHeaderMenu] = useState<{
        x: number;
        y: number;
        type: 'col' | 'row';
        startIdx: number;
        endIdx: number
    } | null>(null);

    const historyRef = useRef(new HistoryStack());
    const [, forceUpdate] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const editInputRef = useRef<HTMLInputElement>(null);
    const selectionModeRef = useRef<'cell' | 'col' | 'row'>('cell');
    const hasUserSelectedRef = useRef(false);
    const pendingScrollRestoreRef = useRef<{ top: number; left: number } | null>(null);
    const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
    const dragThresholdMetRef = useRef(false);
    const colResizeRef = useRef<{ col: number; startX: number; startWidth: number } | null>(null);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const r = colResizeRef.current;
            if (!r) return;
            const delta = e.clientX - r.startX;
            const newWidth = Math.max(40, r.startWidth + delta);
            setColWidths(prev => {
                const next = [...prev];
                next[r.col] = newWidth;
                return next;
            });
        };
        const handleMouseUp = () => {
            const r = colResizeRef.current;
            if (!r) return;
            colResizeRef.current = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            setColWidths(prev => {
                if (onColumnResizeEnd) onColumnResizeEnd(prev);
                return prev;
            });
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [onColumnResizeEnd]);

    const frozenColLefts = useMemo(() => {
        const offsets: number[] = [];
        let acc = ROW_HEADER_WIDTH;
        for (let i = 0; i < frozenCols; i++) {
            offsets.push(acc);
            acc += colWidths[i] || DEFAULT_COL_WIDTH;
        }
        return offsets;
    }, [frozenCols, colWidths]);

    const frozenRowTops = useMemo(() => {
        const offsets: number[] = [];
        let acc = 0;
        for (let i = 0; i < frozenRows; i++) {
            offsets.push(acc);
            acc += rowHeights[i] || DEFAULT_ROW_HEIGHT;
        }
        return offsets;
    }, [frozenRows, rowHeights]);

    useEffect(() => {
        if (!stateChangeReadyRef.current) {
            stateChangeReadyRef.current = true;
            return;
        }
        onStateChange?.({
            hiddenCols: Array.from(hiddenCols).sort((a, b) => a - b),
            hiddenRows: Array.from(hiddenRows).sort((a, b) => a - b),
        });
    }, [hiddenCols, hiddenRows, onStateChange]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        if (!scrollRestoreRef.current && (initialScrollLeft > 0 || initialScrollTop > 0)) {
            scrollRestoreRef.current = true;
            requestAnimationFrame(() => {
                el.scrollLeft = initialScrollLeft;
                el.scrollTop = initialScrollTop;
            });
        }
    }, [initialScrollLeft, initialScrollTop]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el || !onScrollChange) return;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const handler = () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                onScrollChange({scrollLeft: el.scrollLeft, scrollTop: el.scrollTop});
            }, 300);
        };
        el.addEventListener('scroll', handler, {passive: true});
        return () => {
            el.removeEventListener('scroll', handler);
            if (timer) clearTimeout(timer);
        };
    }, [onScrollChange]);

    const getCell = useCallback((row: number, col: number): CellData | undefined => {
        return cells.get(cellKey(row, col));
    }, [cells]);

    const getCellStyle = useCallback((row: number, col: number): CellStyle => {
        return cells.get(cellKey(row, col))?.style || {};
    }, [cells]);

    const getSelectionRange = useCallback(() => {
        const minR = Math.min(selection.startRow, selection.endRow);
        const maxR = Math.max(selection.startRow, selection.endRow);
        const minC = Math.min(selection.startCol, selection.endCol);
        const maxC = Math.max(selection.startCol, selection.endCol);
        return {minR, maxR, minC, maxC};
    }, [selection]);

    const isInSelection = useCallback((row: number, col: number): boolean => {
        if (!hasUserSelectedRef.current) return false;
        if (extraCells.has(cellKey(row, col))) return true;
        const {minR, maxR, minC, maxC} = getSelectionRange();
        return row >= minR && row <= maxR && col >= minC && col <= maxC;
    }, [getSelectionRange, extraCells]);

    const selectionStats = useMemo(() => {
        const {minR, maxR, minC, maxC} = getSelectionRange();

        let sum = 0;
        let count = 0;
        for (let r = minR; r <= maxR; r++) {
            if (hiddenRows.has(r)) continue;
            for (let c = minC; c <= maxC; c++) {
                if (hiddenCols.has(c)) continue;
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
        return {sum, count, average: sum / count};
    }, [selection, cells, merges, hiddenRows, hiddenCols, extraCells, getSelectionRange]);

    const pushHistory = useCallback((action: { type: string; undo: () => void; redo: () => void }) => {
        historyRef.current.push(action);
        forceUpdate((x) => x + 1);
    }, []);

    const handleUndo = useCallback(() => {
        if (historyRef.current.undo()) {
            forceUpdate((x) => x + 1);
        }
    }, []);

    const handleRedo = useCallback(() => {
        if (historyRef.current.redo()) {
            forceUpdate((x) => x + 1);
        }
    }, []);

    const setCellValue = useCallback((row: number, col: number, value: string) => {
        const oldCell = cells.get(cellKey(row, col));
        const oldValue = oldCell?.value || '';
        if (oldValue === value) return;
        const newCells = new Map(cells);
        const style = oldCell?.style;
        if (value === '' && !style) {
            newCells.delete(cellKey(row, col));
        } else {
            newCells.set(cellKey(row, col), {value, style});
        }
        setCells(newCells);
        pushHistory({
            type: 'edit',
            undo: () => {
                setCells((prev) => {
                    const nc = new Map(prev);
                    if (oldValue === '' && !style) nc.delete(cellKey(row, col));
                    else nc.set(cellKey(row, col), {value: oldValue, style});
                    return nc;
                });
            },
            redo: () => {
                setCells((prev) => {
                    const nc = new Map(prev);
                    if (value === '' && !style) nc.delete(cellKey(row, col));
                    else nc.set(cellKey(row, col), {value, style});
                    return nc;
                });
            },
        });
    }, [cells, pushHistory]);

    const applyStyleToSelection = useCallback((stylePatch: Partial<CellStyle>) => {
        const {minR, maxR, minC, maxC} = getSelectionRange();
        const oldStyles = new Map<string, CellStyle | undefined>();
        const newCells = new Map(cells);

        for (let r = minR; r <= maxR; r++) {
            for (let c = minC; c <= maxC; c++) {
                const key = cellKey(r, c);
                const cell = newCells.get(key);
                oldStyles.set(key, cell?.style);
                const newStyle = {...(cell?.style || {}), ...stylePatch};
                if (cell) {
                    newCells.set(key, {...cell, style: newStyle});
                } else {
                    newCells.set(key, {value: '', style: newStyle});
                }
            }
        }
        setCells(newCells);
        pushHistory({
            type: 'style',
            undo: () => {
                setCells((prev) => {
                    const nc = new Map(prev);
                    oldStyles.forEach((s, key) => {
                        const cell = nc.get(key);
                        if (cell) {
                            if (s === undefined && cell.value === '') nc.delete(key);
                            else nc.set(key, {...cell, style: s});
                        }
                    });
                    return nc;
                });
            },
            redo: () => {
                setCells((prev) => {
                    const nc = new Map(prev);
                    for (let r = minR; r <= maxR; r++) {
                        for (let c = minC; c <= maxC; c++) {
                            const key = cellKey(r, c);
                            const cell = nc.get(key);
                            nc.set(key, {value: cell?.value || '', style: {...(cell?.style || {}), ...stylePatch}});
                        }
                    }
                    return nc;
                });
            },
        });
    }, [getSelectionRange, cells, pushHistory]);

    const handleMerge = useCallback(() => {
        const {minR, maxR, minC, maxC} = getSelectionRange();
        if (minR === maxR && minC === maxC) return;
        const rowSpan = maxR - minR + 1;
        const colSpan = maxC - minC + 1;
        const newMerge: MergeCell = {row: minR, col: minC, rowSpan, colSpan};
        const filtered = merges.filter((m) => {
            return !(m.row >= minR && m.row < maxR + 1 && m.col >= minC && m.col < maxC + 1);
        });
        const newMerges = [...filtered, newMerge];
        const oldMerges = merges;
        setMerges(newMerges);
        pushHistory({
            type: 'merge',
            undo: () => setMerges(oldMerges),
            redo: () => setMerges(newMerges),
        });
    }, [getSelectionRange, merges, pushHistory]);

    const handleUnmerge = useCallback(() => {
        const {minR, maxR, minC, maxC} = getSelectionRange();
        const toRemove: MergeCell[] = [];
        const remaining: MergeCell[] = [];
        for (const m of merges) {
            if (m.row >= minR && m.row + m.rowSpan - 1 <= maxR && m.col >= minC && m.col + m.colSpan - 1 <= maxC) {
                toRemove.push(m);
            } else {
                remaining.push(m);
            }
        }
        if (toRemove.length === 0) return;
        const oldMerges = merges;
        setMerges(remaining);
        pushHistory({
            type: 'unmerge',
            undo: () => setMerges(oldMerges),
            redo: () => setMerges(remaining),
        });
    }, [getSelectionRange, merges, pushHistory]);

    const addRows = useCallback((count: number) => {
        const oldRows = rows;
        const oldHeights = rowHeights;
        setRows(rows + count);
        setRowHeights([...rowHeights, ...Array(count).fill(DEFAULT_ROW_HEIGHT)]);
        pushHistory({
            type: 'addRows',
            undo: () => {
                setRows(oldRows);
                setRowHeights(oldHeights);
            },
            redo: () => {
                setRows(oldRows + count);
                setRowHeights([...oldHeights, ...Array(count).fill(DEFAULT_ROW_HEIGHT)]);
            },
        });
    }, [rows, rowHeights, pushHistory]);

    const handleCopy = useCallback(async () => {
        const {minR, maxR, minC, maxC} = getSelectionRange();
        const lines: string[] = [];
        for (let r = minR; r <= maxR; r++) {
            const rowVals: string[] = [];
            for (let c = minC; c <= maxC; c++) {
                rowVals.push(cells.get(cellKey(r, c))?.value || '');
            }
            lines.push(rowVals.join('\t'));
        }
        if (extraCells.size > 0) {
            const extras: string[] = [];
            for (const key of extraCells) {
                const cell = cells.get(key);
                extras.push(cell?.value || '');
            }
            if (extras.length > 0) {
                lines.push('');
                lines.push(extras.join('\t'));
            }
        }
        const text = lines.join('\n');
        let success = false;
        try {
            await navigator.clipboard.writeText(text);
            success = true;
        } catch {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            try {
                success = document.execCommand('copy');
            } catch {
                success = false;
            }
            document.body.removeChild(textarea);
        }
        setCopiedSelection(true);
        if (success) {
            toast.success('已复制');
        } else {
            toast.error('复制失败');
        }
    }, [getSelectionRange, cells, extraCells]);

    const handleCut = useCallback(() => {
        handleCopy();
        const {minR, maxR, minC, maxC} = getSelectionRange();
        const oldCells = new Map(cells);
        const newCells = new Map(cells);
        for (let r = minR; r <= maxR; r++) {
            for (let c = minC; c <= maxC; c++) {
                const key = cellKey(r, c);
                const cell = newCells.get(key);
                if (cell) {
                    if (cell.style && Object.keys(cell.style).length > 0) {
                        newCells.set(key, {...cell, value: ''});
                    } else {
                        newCells.delete(key);
                    }
                }
            }
        }
        setCells(newCells);
        pushHistory({
            type: 'cut',
            undo: () => setCells(new Map(oldCells)),
            redo: () => setCells(new Map(newCells)),
        });
    }, [handleCopy, getSelectionRange, cells, pushHistory]);

    const handlePaste = useCallback(async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (!text) return;
            const lines = text.split('\n').map((l) => l.split('\t'));
            const startR = selection.startRow;
            const startC = selection.startCol;
            const oldCells = new Map(cells);
            const newCells = new Map(cells);
            for (let r = 0; r < lines.length; r++) {
                for (let c = 0; c < lines[r].length; c++) {
                    const row = startR + r;
                    const col = startC + c;
                    if (row >= rows || col >= cols) continue;
                    const key = cellKey(row, col);
                    const existing = newCells.get(key);
                    newCells.set(key, {value: lines[r][c], style: existing?.style});
                }
            }
            setCells(newCells);
            pushHistory({
                type: 'paste',
                undo: () => setCells(new Map(oldCells)),
                redo: () => setCells(new Map(newCells)),
            });
        } catch {
            // ignore
        }
    }, [selection, cells, rows, cols, pushHistory]);

    const handlePasteSpecial = useCallback(async (mode: 'values' | 'formats') => {
        if (mode === 'values') {
            await handlePaste();
            return;
        }
        // 格式粘贴：将选区左上角单元格的样式应用到整个选区
        const sourceStyle = getCellStyle(selection.startRow, selection.startCol);
        applyStyleToSelection(sourceStyle);
    }, [handlePaste, getCellStyle, selection, applyStyleToSelection]);

    const handleDeleteRows = useCallback(() => {
        const {minR, maxR} = getSelectionRange();
        const count = maxR - minR + 1;
        const oldRowsCount = rows;
        const oldHeights = [...rowHeights];
        const newRowsCount = rows - count;
        const newHeights = [...rowHeights.slice(0, minR), ...rowHeights.slice(maxR + 1)];
        const oldCells = new Map(cells);
        const newCells = new Map<string, CellData>();
        for (const [key, val] of cells) {
            const [rStr, cStr] = key.split(',');
            const r = parseInt(rStr, 10);
            const c = parseInt(cStr, 10);
            if (r < minR) {
                newCells.set(key, val);
            } else if (r > maxR) {
                newCells.set(cellKey(r - count, c), val);
            }
        }
        const oldMerges = merges;
        const newMerges: MergeCell[] = merges
            .filter((m) => m.row + m.rowSpan - 1 < minR || m.row > maxR)
            .map((m) => (m.row > maxR ? {...m, row: m.row - count} : m));
        setRows(newRowsCount);
        setRowHeights(newHeights);
        setCells(newCells);
        setMerges(newMerges);
        setSelection({startRow: minR, startCol: selection.startCol, endRow: minR, endCol: selection.endCol});
        pushHistory({
            type: 'deleteRows',
            undo: () => {
                setRows(oldRowsCount);
                setRowHeights(oldHeights);
                setCells(oldCells);
                setMerges(oldMerges);
            },
            redo: () => {
                setRows(newRowsCount);
                setRowHeights(newHeights);
                setCells(newCells);
                setMerges(newMerges);
            },
        });
    }, [getSelectionRange, rowHeights, cells, merges, rows, selection.startCol, selection.endCol, pushHistory]);

    const handleHideRowsRange = useCallback((minR: number, maxR: number) => {
        const oldHidden = new Set(hiddenRows);
        const newHidden = new Set(hiddenRows);
        for (let r = minR; r <= maxR; r++) newHidden.add(r);
        setHiddenRows(newHidden);
        pushHistory({
            type: 'hideRows',
            undo: () => setHiddenRows(oldHidden),
            redo: () => setHiddenRows(newHidden),
        });
    }, [hiddenRows, pushHistory]);

    const handleHideRows = useCallback(() => {
        const {minR, maxR} = getSelectionRange();
        handleHideRowsRange(minR, maxR);
    }, [getSelectionRange, handleHideRowsRange]);

    const handleUnhideRows = useCallback(() => {
        const {minR, maxR} = getSelectionRange();
        const oldHidden = new Set(hiddenRows);
        const newHidden = new Set(hiddenRows);
        for (let r = minR; r <= maxR; r++) newHidden.delete(r);
        if (newHidden.size === oldHidden.size) return;
        setHiddenRows(newHidden);
        pushHistory({
            type: 'unhideRows',
            undo: () => setHiddenRows(oldHidden),
            redo: () => setHiddenRows(newHidden),
        });
    }, [getSelectionRange, hiddenRows, pushHistory]);

    const handleHideCols = useCallback((minC: number, maxC: number) => {
        const oldHidden = new Set(hiddenCols);
        const newHidden = new Set(hiddenCols);
        for (let c = minC; c <= maxC; c++) newHidden.add(c);
        setHiddenCols(newHidden);
        pushHistory({
            type: 'hideCols',
            undo: () => setHiddenCols(oldHidden),
            redo: () => setHiddenCols(newHidden),
        });
    }, [hiddenCols, pushHistory]);

    const handleUnhideCol = useCallback((col: number) => {
        let minC = col;
        let maxC = col;
        while (minC > 0 && hiddenCols.has(minC - 1)) minC--;
        while (maxC < cols - 1 && hiddenCols.has(maxC + 1)) maxC++;
        const oldHidden = new Set(hiddenCols);
        const newHidden = new Set(hiddenCols);
        for (let c = minC; c <= maxC; c++) newHidden.delete(c);
        setHiddenCols(newHidden);
        pushHistory({
            type: 'unhideCol',
            undo: () => setHiddenCols(oldHidden),
            redo: () => setHiddenCols(newHidden),
        });
    }, [hiddenCols, cols, pushHistory]);

    const handleUnhideRow = useCallback((row: number) => {
        let minR = row;
        let maxR = row;
        while (minR > 0 && hiddenRows.has(minR - 1)) minR--;
        while (maxR < rows - 1 && hiddenRows.has(maxR + 1)) maxR++;
        const oldHidden = new Set(hiddenRows);
        const newHidden = new Set(hiddenRows);
        for (let r = minR; r <= maxR; r++) newHidden.delete(r);
        setHiddenRows(newHidden);
        pushHistory({
            type: 'unhideRow',
            undo: () => setHiddenRows(oldHidden),
            redo: () => setHiddenRows(newHidden),
        });
    }, [hiddenRows, rows, pushHistory]);

    const handleColHeaderMouseDown = useCallback((col: number, e: React.MouseEvent) => {
        if (e.button !== 0) return;
        if (hiddenCols.has(col)) return;
        const container = containerRef.current;
        if (container) {
            pendingScrollRestoreRef.current = {top: container.scrollTop, left: container.scrollLeft};
        }
        hasUserSelectedRef.current = true;
        e.preventDefault();
        setSelectionMode('col');
        setIsSelecting(true);
        setCopiedSelection(false);
        setSelection({startRow: 0, startCol: col, endRow: rows - 1, endCol: col});
    }, [hiddenCols, rows]);

    const handleColHeaderMouseEnter = useCallback((col: number) => {
        if (!isSelecting || selectionMode !== 'col') return;
        if (hiddenCols.has(col)) return;
        setSelection((prev) => ({...prev, endCol: col}));
    }, [isSelecting, selectionMode, hiddenCols]);

    const handleRowHeaderMouseDown = useCallback((row: number, e: React.MouseEvent) => {
        if (e.button !== 0) return;
        if (hiddenRows.has(row)) return;
        const container = containerRef.current;
        if (container) {
            pendingScrollRestoreRef.current = {top: container.scrollTop, left: container.scrollLeft};
        }
        hasUserSelectedRef.current = true;
        e.preventDefault();
        setSelectionMode('row');
        setIsSelecting(true);
        setCopiedSelection(false);
        setSelection({startRow: row, startCol: 0, endRow: row, endCol: cols - 1});
    }, [hiddenRows, cols]);

    const handleRowHeaderMouseEnter = useCallback((row: number) => {
        if (!isSelecting || selectionMode !== 'row') return;
        if (hiddenRows.has(row)) return;
        setSelection((prev) => ({...prev, endRow: row}));
    }, [isSelecting, selectionMode, hiddenRows]);

    const handleHeaderContextMenu = useCallback((e: React.MouseEvent, type: 'col' | 'row', idx: number) => {
        e.preventDefault();
        if (type === 'col') {
            if (hiddenCols.has(idx)) return;
            const inCurSelection = selectionMode === 'col' && isInSelection(0, idx);
            if (!inCurSelection) {
                setSelectionMode('col');
                setSelection({startRow: 0, startCol: idx, endRow: rows - 1, endCol: idx});
            }
            const {minC, maxC} = inCurSelection ? getSelectionRange() : {minC: idx, maxC: idx};
            setHeaderMenu({x: e.clientX, y: e.clientY, type: 'col', startIdx: minC, endIdx: maxC});
        } else {
            if (hiddenRows.has(idx)) return;
            const inCurSelection = selectionMode === 'row' && isInSelection(idx, 0);
            if (!inCurSelection) {
                setSelectionMode('row');
                setSelection({startRow: idx, startCol: 0, endRow: idx, endCol: cols - 1});
            }
            const {minR, maxR} = inCurSelection ? getSelectionRange() : {minR: idx, maxR: idx};
            setHeaderMenu({x: e.clientX, y: e.clientY, type: 'row', startIdx: minR, endIdx: maxR});
        }
    }, [hiddenCols, hiddenRows, selectionMode, isInSelection, getSelectionRange, rows, cols]);

    const handleCopyAsImage = useCallback(async () => {
        const {minR, maxR, minC, maxC} = getSelectionRange();

        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'fixed';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '0';
        tempContainer.style.backgroundColor = '#ffffff';

        const visibleCols: number[] = [];
        const visibleRows: number[] = [];
        for (let c = minC; c <= maxC; c++) {
            if (!hiddenCols.has(c)) visibleCols.push(c);
        }
        for (let r = minR; r <= maxR; r++) {
            if (!hiddenRows.has(r)) visibleRows.push(r);
        }
        if (visibleCols.length === 0 || visibleRows.length === 0) return;

        const colOffsets: number[] = [];
        const rowOffsets: number[] = [];
        let totalWidth = 0;
        let totalHeight = 0;
        for (const c of visibleCols) {
            colOffsets.push(totalWidth);
            totalWidth += colWidths[c];
        }
        for (const r of visibleRows) {
            rowOffsets.push(totalHeight);
            totalHeight += rowHeights[r];
        }

        const gridEl = document.createElement('div');
        gridEl.style.position = 'relative';
        gridEl.style.width = `${totalWidth}px`;
        gridEl.style.height = `${totalHeight}px`;
        gridEl.style.boxSizing = 'border-box';
        gridEl.style.backgroundColor = '#ffffff';

        for (let vi = 0; vi < visibleRows.length; vi++) {
            const r = visibleRows[vi];
            for (let vj = 0; vj < visibleCols.length; vj++) {
                const c = visibleCols[vj];
                const merge = isInMerge(merges, r, c);
                if (merge && !isMergeOrigin(merge, r, c)) continue;

                const cell = getCell(r, c);
                const style = cell?.style || {};
                const value = cell?.value || '';

                const left = colOffsets[vj];
                const top = rowOffsets[vi];

                let cellWidth = colWidths[c];
                let cellHeight = rowHeights[r];
                if (merge && isMergeOrigin(merge, r, c)) {
                    cellWidth = 0;
                    for (let i = 0; i < merge.colSpan; i++) {
                        const colIdx = c + i;
                        if (!hiddenCols.has(colIdx) && colIdx >= minC && colIdx <= maxC) {
                            cellWidth += colWidths[colIdx];
                        }
                    }
                    cellHeight = 0;
                    for (let i = 0; i < merge.rowSpan; i++) {
                        const rowIdx = r + i;
                        if (!hiddenRows.has(rowIdx) && rowIdx >= minR && rowIdx <= maxR) {
                            cellHeight += rowHeights[rowIdx];
                        }
                    }
                }

                const cellDiv = document.createElement('div');
                cellDiv.style.position = 'absolute';
                cellDiv.style.left = `${left}px`;
                cellDiv.style.top = `${top}px`;
                cellDiv.style.width = `${cellWidth}px`;
                cellDiv.style.height = `${cellHeight}px`;
                cellDiv.style.boxSizing = 'border-box';
                cellDiv.style.border = '1px solid #e5e7eb';
                cellDiv.style.backgroundColor = style.bgColor || '#ffffff';
                cellDiv.style.overflow = 'hidden';
                cellDiv.style.padding = '0 4px';
                cellDiv.style.textAlign = style.align === 'left' ? 'left' : style.align === 'right' ? 'right' : 'center';
                cellDiv.style.fontWeight = style.bold ? '700' : '400';
                cellDiv.style.fontStyle = style.italic ? 'italic' : 'normal';
                const decorations: string[] = [];
                if (style.underline) decorations.push('underline');
                if (style.strikethrough) decorations.push('line-through');
                cellDiv.style.textDecoration = decorations.join(' ') || 'none';
                cellDiv.style.fontFamily = style.fontFamily || DEFAULT_FONT_FAMILY;
                cellDiv.style.fontSize = `${style.fontSize || DEFAULT_FONT_SIZE}px`;
                cellDiv.style.color = style.color || '#000';
                cellDiv.style.whiteSpace = 'nowrap';
                cellDiv.style.textOverflow = 'ellipsis';
                cellDiv.style.verticalAlign = 'middle';

                const span = document.createElement('span');
                span.style.display = 'inline-block';
                span.style.lineHeight = 'normal';
                span.style.verticalAlign = 'middle';
                span.style.width = '100%';
                span.style.textAlign = 'inherit';
                span.textContent = value;

                cellDiv.appendChild(span);

                gridEl.appendChild(cellDiv);
            }
        }

        tempContainer.appendChild(gridEl);
        document.body.appendChild(tempContainer);

        try {
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            const {default: html2canvas} = await import('html2canvas');
            const canvas = await html2canvas(gridEl, {
                backgroundColor: '#ffffff',
                scale: 2,
                useCORS: true,
                logging: false,
            });

            const blob = await new Promise<Blob | null>((resolve) =>
                canvas.toBlob(resolve, 'image/png'),
            );

            if (!blob) {
                toast.error('复制为图片失败');
                return;
            }

            if (navigator.clipboard && window.ClipboardItem) {
                await navigator.clipboard.write([
                    new ClipboardItem({'image/png': blob}),
                ]);
                toast.success('已复制为图片到剪贴板');
            } else {
                if (!assertDownloadAllowed('selection.png', 'png')) return;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'selection.png';
                a.click();
                URL.revokeObjectURL(url);
                toast.success('已下载为图片');
            }
        } catch {
            toast.error('复制为图片失败');
        } finally {
            document.body.removeChild(tempContainer);
        }
    }, [getSelectionRange, getCell, merges, colWidths, rowHeights, hiddenCols, hiddenRows]);

    const handleSelectAll = useCallback(() => {
        let firstVisibleCol = -1;
        let lastVisibleCol = -1;
        for (let c = 0; c < cols; c++) {
            if (!hiddenCols.has(c)) {
                if (firstVisibleCol === -1) firstVisibleCol = c;
                lastVisibleCol = c;
            }
        }
        let firstVisibleRow = -1;
        let lastVisibleRow = -1;
        for (let r = 0; r < rows; r++) {
            if (!hiddenRows.has(r)) {
                if (firstVisibleRow === -1) firstVisibleRow = r;
                lastVisibleRow = r;
            }
        }
        if (firstVisibleCol === -1 || firstVisibleRow === -1) return;
        hasUserSelectedRef.current = true;
        setSelectionMode('cell');
        setExtraCells(new Set());
        setSelection({
            startRow: firstVisibleRow,
            startCol: firstVisibleCol,
            endRow: lastVisibleRow,
            endCol: lastVisibleCol,
        });
        setAnchorCell({row: firstVisibleRow, col: firstVisibleCol});
    }, [cols, rows, hiddenCols, hiddenRows]);

    const handleContextMenu = useCallback((row: number, col: number, e: React.MouseEvent) => {
        hasUserSelectedRef.current = true;
        e.preventDefault();
        setSelectionMode('cell');
        if (!isInSelection(row, col)) {
            setSelection({startRow: row, startCol: col, endRow: row, endCol: col});
        }
        setContextMenu({x: e.clientX, y: e.clientY});
    }, [isInSelection]);

    const handleZoomIn = () => setZoom((z) => Math.min(400, z + 10));
    const handleZoomOut = () => setZoom((z) => Math.max(25, z - 10));

    const toggleFullscreen = useCallback(() => {
        if (!wrapperRef.current) return;
        if (!document.fullscreenElement) {
            wrapperRef.current.requestFullscreen?.().catch(() => {
                toast.error('无法进入全屏模式');
            });
        } else {
            document.exitFullscreen?.().catch(() => {
            });
        }
    }, []);

    useEffect(() => {
        const onFsChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', onFsChange);
        return () => document.removeEventListener('fullscreenchange', onFsChange);
    }, []);

    const startEdit = useCallback((row: number, col: number) => {
        const cell = getCell(row, col);
        setEditing({row, col});
        setEditValue(cell?.value || '');
        setTimeout(() => editInputRef.current?.focus({preventScroll: true}), 0);
    }, [getCell]);

    const finishEdit = useCallback((save: boolean) => {
        if (!editing) return;
        if (save) {
            setCellValue(editing.row, editing.col, editValue);
        }
        setEditing(null);
        setEditValue('');
    }, [editing, editValue, setCellValue]);

    const handleCellMouseDown = useCallback((row: number, col: number, e: React.MouseEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        if (editing) finishEdit(true);
        hasUserSelectedRef.current = true;
        setSelectionMode('cell');
        setCopiedSelection(false);

        if (e.shiftKey && anchorCell) {
            const container = containerRef.current;
            if (container) {
                pendingScrollRestoreRef.current = {top: container.scrollTop, left: container.scrollLeft};
            }
            setIsSelecting(false);
            setExtraCells(new Set());
            setSelection({
                startRow: anchorCell.row,
                startCol: anchorCell.col,
                endRow: row,
                endCol: col,
            });
        } else if (e.metaKey || e.ctrlKey) {
            const container = containerRef.current;
            if (container) {
                pendingScrollRestoreRef.current = {top: container.scrollTop, left: container.scrollLeft};
            }
            setIsSelecting(false);
            const key = cellKey(row, col);
            setExtraCells((prev: Set<string>) => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
            });
            setAnchorCell({row, col});
        } else {
            setIsSelecting(true);
            setExtraCells(new Set());
            setSelection({startRow: row, startCol: col, endRow: row, endCol: col});
            setAnchorCell({row, col});
            mouseDownPosRef.current = {x: e.clientX, y: e.clientY};
            dragThresholdMetRef.current = false;
        }
    }, [editing, finishEdit, anchorCell]);

    useEffect(() => {
        if (!isSelecting) return;

        let rafId = 0;
        let lastX = 0;
        let lastY = 0;
        let pending = false;

        const EDGE = 30;
        const SPEED = 15;

        const cellFromPoint = (cx: number, cy: number): { row: number; col: number } | null => {
            const container = containerRef.current;
            if (!container) return null;

            const el = document.elementFromPoint(cx, cy);
            if (el) {
                const td = (el as HTMLElement).closest('td');
                if (td && td.dataset.row !== undefined && td.dataset.col !== undefined) {
                    return {row: parseInt(td.dataset.row, 10), col: parseInt(td.dataset.col, 10)};
                }
            }

            const rect = container.getBoundingClientRect();
            const zf = zoom / 100;
            const rx = (cx - rect.left + container.scrollLeft) / zf - ROW_HEADER_WIDTH;
            const ry = (cy - rect.top + container.scrollTop) / zf - COL_HEADER_HEIGHT;

            if (rx < 0 || ry < 0) return null;

            let col = 0;
            let colFound = false;
            let acc = 0;
            for (let c = 0; c < cols; c++) {
                acc += colWidths[c];
                if (rx < acc) {
                    col = c;
                    colFound = true;
                    break;
                }
            }
            if (!colFound) col = cols - 1;

            let row = 0;
            let rowFound = false;
            acc = 0;
            for (let r = 0; r < rows; r++) {
                acc += rowHeights[r];
                if (ry < acc) {
                    row = r;
                    rowFound = true;
                    break;
                }
            }
            if (!rowFound) row = rows - 1;

            return {row, col};
        };

        const tick = () => {
            const container = containerRef.current;
            if (container) {
                const rect = container.getBoundingClientRect();
                let scrolled = false;

                if (lastX > rect.right - EDGE) {
                    container.scrollLeft += SPEED;
                    scrolled = true;
                } else if (lastX < rect.left + EDGE) {
                    container.scrollLeft -= SPEED;
                    scrolled = true;
                }
                if (lastY > rect.bottom - EDGE) {
                    container.scrollTop += SPEED;
                    scrolled = true;
                } else if (lastY < rect.top + EDGE) {
                    container.scrollTop -= SPEED;
                    scrolled = true;
                }

                if (selectionModeRef.current === 'cell' && (scrolled || pending)) {
                    const res = cellFromPoint(lastX, lastY);
                    if (res) {
                        setSelection((prev) =>
                            prev.endRow === res.row && prev.endCol === res.col
                                ? prev
                                : {...prev, endRow: res.row, endCol: res.col},
                        );
                    }
                    pending = false;
                }
            }
            rafId = requestAnimationFrame(tick);
        };

        const DRAG_THRESHOLD_PX = 5;
        const onMove = (e: MouseEvent) => {
            lastX = e.clientX;
            lastY = e.clientY;
            if (!dragThresholdMetRef.current && mouseDownPosRef.current) {
                const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
                const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);
                if (dx < DRAG_THRESHOLD_PX && dy < DRAG_THRESHOLD_PX) return;
                dragThresholdMetRef.current = true;
            }
            pending = true;
        };

        const onUp = () => {
            setIsSelecting(false);
            mouseDownPosRef.current = null;
            dragThresholdMetRef.current = false;
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        rafId = requestAnimationFrame(tick);

        return () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            cancelAnimationFrame(rafId);
        };
    }, [isSelecting, zoom, cols, rows, colWidths, rowHeights]);

    useEffect(() => {
        if (!copiedSelection) return;
        const handleOutsideMouseDown = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setCopiedSelection(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideMouseDown);
        return () => document.removeEventListener('mousedown', handleOutsideMouseDown);
    }, [copiedSelection]);

    useEffect(() => {
        selectionModeRef.current = selectionMode;
    }, [selectionMode]);

    useEffect(() => {
        if (!headerMenu) return;
        const handleClick = () => setHeaderMenu(null);
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setHeaderMenu(null);
        };
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKey);
        };
    }, [headerMenu]);

    const scrollRestoreRafRef = useRef(0);

    useLayoutEffect(() => {
        if (!pendingScrollRestoreRef.current) return;
        const {top, left} = pendingScrollRestoreRef.current;
        pendingScrollRestoreRef.current = null;
        cancelAnimationFrame(scrollRestoreRafRef.current);
        scrollRestoreRafRef.current = requestAnimationFrame(() => {
            const container = containerRef.current;
            if (container) {
                container.scrollTop = top;
                container.scrollLeft = left;
            }
        });
    }, [selection]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const tag = target?.tagName;
            if (
                tag === 'INPUT' ||
                tag === 'TEXTAREA' ||
                target?.isContentEditable
            ) {
                return;
            }
            const isCtrl = e.ctrlKey || e.metaKey;

            // Always-available shortcuts
            if (isCtrl && e.key.toLowerCase() === 'z' && !e.shiftKey) {
                e.preventDefault();
                handleUndo();
                return;
            }
            if ((isCtrl && e.key.toLowerCase() === 'y') || (isCtrl && e.shiftKey && e.key.toLowerCase() === 'z')) {
                e.preventDefault();
                handleRedo();
                return;
            }
            if (isCtrl && e.key.toLowerCase() === 'f') {
                e.preventDefault();
                setFindMode('find');
                setFindReplaceOpen(true);
                return;
            }
            if (isCtrl && e.key.toLowerCase() === 'h') {
                e.preventDefault();
                setFindMode('replace');
                setFindReplaceOpen(true);
                return;
            }
            if (isCtrl && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                handleSelectAll();
                return;
            }

            // Ctrl+C: only intercept if user has interacted with cells
            if (isCtrl && e.key.toLowerCase() === 'c') {
                if (!hasUserSelectedRef.current) return;
                e.preventDefault();
                void handleCopy();
                return;
            }

            // All other shortcuts require prior cell interaction
            if (!hasUserSelectedRef.current) return;

            if (isCtrl && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                const currentStyle = getCellStyle(selection.startRow, selection.startCol);
                applyStyleToSelection({bold: !currentStyle.bold});
                return;
            }
            if (isCtrl && e.key.toLowerCase() === 'i') {
                e.preventDefault();
                const currentStyle = getCellStyle(selection.startRow, selection.startCol);
                applyStyleToSelection({italic: !currentStyle.italic});
                return;
            }
            if (isCtrl && e.key.toLowerCase() === 'u') {
                e.preventDefault();
                const currentStyle = getCellStyle(selection.startRow, selection.startCol);
                applyStyleToSelection({underline: !currentStyle.underline});
                return;
            }
            if (isCtrl && e.key.toLowerCase() === 'x') {
                e.preventDefault();
                handleCut();
                return;
            }
            if (isCtrl && e.key.toLowerCase() === 'v') {
                e.preventDefault();
                void handlePaste();
                return;
            }
            if (isCtrl && e.shiftKey && e.key.toLowerCase() === 'l') {
                e.preventDefault();
                applyStyleToSelection({align: 'left'});
                return;
            }
            if (isCtrl && e.shiftKey && e.key.toLowerCase() === 'e') {
                e.preventDefault();
                applyStyleToSelection({align: 'center'});
                return;
            }
            if (isCtrl && e.shiftKey && e.key.toLowerCase() === 'r') {
                e.preventDefault();
                applyStyleToSelection({align: 'right'});
                return;
            }
            if (editing) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    finishEdit(true);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    finishEdit(false);
                }
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                startEdit(selection.startRow, selection.startCol);
                return;
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                const {minR, maxR, minC, maxC} = getSelectionRange();
                const oldValues = new Map<string, string>();
                const newCells = new Map(cells);
                for (let r = minR; r <= maxR; r++) {
                    for (let c = minC; c <= maxC; c++) {
                        const key = cellKey(r, c);
                        const cell = newCells.get(key);
                        if (cell) {
                            oldValues.set(key, cell.value);
                            if (cell.style && Object.keys(cell.style).length > 0) {
                                newCells.set(key, {...cell, value: ''});
                            } else {
                                newCells.delete(key);
                            }
                        }
                    }
                }
                setCells(newCells);
                pushHistory({
                    type: 'clear',
                    undo: () => {
                        setCells((prev) => {
                            const nc = new Map(prev);
                            oldValues.forEach((v, k) => {
                                const cell = nc.get(k);
                                if (cell) nc.set(k, {...cell, value: v});
                                else nc.set(k, {value: v});
                            });
                            return nc;
                        });
                    },
                    redo: () => {
                        setCells((prev) => {
                            const nc = new Map(prev);
                            oldValues.forEach((_v, k) => {
                                const cell = nc.get(k);
                                if (cell) {
                                    if (cell.style && Object.keys(cell.style).length > 0) nc.set(k, {
                                        ...cell,
                                        value: ''
                                    });
                                    else nc.delete(k);
                                }
                            });
                            return nc;
                        });
                    },
                });
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setSelection({startRow: 0, startCol: 0, endRow: 0, endCol: 0});
                setExtraCells(new Set());
                setAnchorCell(null);
                hasUserSelectedRef.current = false;
                return;
            }
            const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
            if (arrowKeys.includes(e.key)) {
                e.preventDefault();
                if (e.shiftKey) {
                    setSelection((prev) => {
                        let r = prev.endRow;
                        let c = prev.endCol;
                        if (e.key === 'ArrowUp') r = Math.max(0, r - 1);
                        if (e.key === 'ArrowDown') r = Math.min(rows - 1, r + 1);
                        if (e.key === 'ArrowLeft') c = Math.max(0, c - 1);
                        if (e.key === 'ArrowRight') c = Math.min(cols - 1, c + 1);
                        return {startRow: prev.startRow, startCol: prev.startCol, endRow: r, endCol: c};
                    });
                    setExtraCells(new Set());
                } else {
                    setExtraCells(new Set());
                    setSelection((prev) => {
                        let r = prev.startRow;
                        let c = prev.startCol;
                        if (e.key === 'ArrowUp') r = Math.max(0, r - 1);
                        if (e.key === 'ArrowDown') r = Math.min(rows - 1, r + 1);
                        if (e.key === 'ArrowLeft') c = Math.max(0, c - 1);
                        if (e.key === 'ArrowRight') c = Math.min(cols - 1, c + 1);
                        return {startRow: r, startCol: c, endRow: r, endCol: c};
                    });
                    setAnchorCell((prev: { row: number; col: number } | null) => {
                        if (!prev) return null;
                        let r = prev.row;
                        let c = prev.col;
                        if (e.key === 'ArrowUp') r = Math.max(0, r - 1);
                        if (e.key === 'ArrowDown') r = Math.min(rows - 1, r + 1);
                        if (e.key === 'ArrowLeft') c = Math.max(0, c - 1);
                        if (e.key === 'ArrowRight') c = Math.min(cols - 1, c + 1);
                        return {row: r, col: c};
                    });
                }
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleUndo, handleRedo, applyStyleToSelection, getCellStyle, getSelectionRange,
        cells, pushHistory, editing, finishEdit, startEdit, selection, rows, cols,
        handleCopy, handleCut, handlePaste, handleSelectAll]);

    const handleFindReplace = useCallback((findText: string, replaceText: string, mode: 'find' | 'replace' | 'replaceAll') => {
        if (!findText) return 0;
        let count = 0;
        const oldCells = new Map(cells);
        const newCells = new Map(cells);
        for (const [key, cell] of newCells) {
            if (cell.value.includes(findText)) {
                if (mode === 'find') {
                    count++;
                } else if (mode === 'replace' && count === 0) {
                    newCells.set(key, {...cell, value: cell.value.replace(findText, replaceText)});
                    count++;
                } else if (mode === 'replaceAll') {
                    newCells.set(key, {...cell, value: cell.value.split(findText).join(replaceText)});
                    count++;
                }
            }
        }
        if (mode !== 'find' && count > 0) {
            setCells(newCells);
            pushHistory({
                type: 'replace',
                undo: () => setCells(new Map(oldCells)),
                redo: () => setCells(new Map(newCells)),
            });
        }
        return count;
    }, [cells, pushHistory]);

    const activeCellStyle = useMemo(() => {
        if (!hasUserSelectedRef.current) return {};
        return getCellStyle(selection.startRow, selection.startCol);
    }, [selection, getCellStyle]);

    const hiddenColGroups: Array<{ start: number; end: number }> = [];
    {
        let i = 0;
        while (i < cols) {
            if (hiddenCols.has(i)) {
                const start = i;
                while (i < cols && hiddenCols.has(i)) i++;
                hiddenColGroups.push({start, end: i - 1});
            } else {
                i++;
            }
        }
    }
    const hiddenRowGroups: Array<{ start: number; end: number }> = [];
    {
        let i = 0;
        while (i < rows) {
            if (hiddenRows.has(i)) {
                const start = i;
                while (i < rows && hiddenRows.has(i)) i++;
                hiddenRowGroups.push({start, end: i - 1});
            } else {
                i++;
            }
        }
    }

    const renderCellContent = (row: number, col: number) => {
        const cell = getCell(row, col);
        const style = cell?.style || {};
        const value = cell?.value || '';
        return (
            <div
                className="h-full w-full flex overflow-hidden px-1"
                style={{
                    justifyContent: style.align === 'left' ? 'flex-start' : style.align === 'right' ? 'flex-end' : 'center',
                    alignItems: style.verticalAlign === 'top' ? 'flex-start' : style.verticalAlign === 'bottom' ? 'flex-end' : 'center',
                    fontWeight: style.bold ? 700 : 400,
                    fontStyle: style.italic ? 'italic' : 'normal',
                    textDecoration: [
                        style.underline ? 'underline' : '',
                        style.strikethrough ? 'line-through' : '',
                    ].filter(Boolean).join(' ') || 'none',
                    fontFamily: style.fontFamily || DEFAULT_FONT_FAMILY,
                    fontSize: `${style.fontSize || DEFAULT_FONT_SIZE}px`,
                    color: style.color || '#000',
                    backgroundColor: style.bgColor || 'transparent',
                    lineHeight: style.lineHeight ? `${style.lineHeight}px` : 'normal',
                }}
            >
          <span
              className={style.whiteSpace === 'normal' ? 'whitespace-pre-wrap text-center w-full' : 'truncate'}
          >
            {value}
          </span>
            </div>
        );
    };

    const renderCell = (row: number, col: number, options?: { isFrozen?: boolean; frozenTop?: number }) => {
        const merge = isInMerge(merges, row, col);
        if (merge && !isMergeOrigin(merge, row, col)) return null;

        const selected = isInSelection(row, col);
        const isActive = hasUserSelectedRef.current && selection.startRow === row && selection.startCol === col;
        const isEditing = editing?.row === row && editing?.col === col;
        const style = getCellStyle(row, col);

        const colHidden = hiddenCols.has(col);
        const rowHidden = hiddenRows.has(row);
        const effectiveWidth = colHidden ? 0 : colWidths[col];
        const effectiveHeight = rowHidden ? 0 : rowHeights[row];
        const cellStyle: React.CSSProperties = {
            width: effectiveWidth,
            height: effectiveHeight,
            minWidth: effectiveWidth,
            maxWidth: effectiveWidth,
        };
        const tdProps: { rowSpan?: number; colSpan?: number } = {};
        if (merge && isMergeOrigin(merge, row, col)) {
            tdProps.rowSpan = merge.rowSpan;
            tdProps.colSpan = merge.colSpan;
        }

        const {minR, maxR, minC, maxC} = getSelectionRange();
        const isTopEdge = row === minR;
        const isBottomEdge = row === maxR;
        const isLeftEdge = col === minC;
        const isRightEdge = col === maxC;
        const borderColor = '#3b82f6';
        const borderWidth = 2;

        return (
            <td
                key={`${row}-${col}`}
                {...tdProps}
                className={cn(
                    'border-r border-b border-gray-200 p-0',
                    selected && !colHidden && !rowHidden && 'bg-blue-50/60',
                    isActive && 'z-10',
                    row < frozenRows && 'bg-gray-50',
                    col < frozenCols && 'bg-gray-50 sticky z-20',
                    (colHidden || rowHidden) && 'border-0',
                    row >= rows - bottomFrozenRows && 'sticky bottom-0 z-[5] bg-blue-50',
                    row >= rows - bottomFrozenRows && col < frozenCols && 'z-[25]',
                    options?.isFrozen && 'sticky z-[22]',
                    options?.isFrozen && col < frozenCols && 'z-[28]',
                )}
                style={{
                    ...cellStyle,
                    position: (col < frozenCols || row >= rows - bottomFrozenRows || options?.isFrozen) ? 'sticky' : (isActive ? 'relative' : undefined),
                    ...(options?.isFrozen && options?.frozenTop !== undefined ? {top: options.frozenTop} : {}),
                    ...(col < frozenCols ? {left: frozenColLefts[col]} : {}),
                    ...(col === frozenCols - 1 ? {boxShadow: '2px 0 4px rgba(0,0,0,0.08)'} : {}),
                    ...(selected ? (copiedSelection ? {
                        borderTop: isTopEdge ? `2px dashed ${borderColor}` : undefined,
                        borderBottom: isBottomEdge ? `2px dashed ${borderColor}` : undefined,
                        borderLeft: isLeftEdge ? `2px dashed ${borderColor}` : undefined,
                        borderRight: isRightEdge ? `2px dashed ${borderColor}` : undefined,
                    } : {
                        boxShadow: [
                            isTopEdge ? `inset 0 2px 0 0 ${borderColor}` : '',
                            isBottomEdge ? `inset 0 -2px 0 0 ${borderColor}` : '',
                            isLeftEdge ? `inset 2px 0 0 0 ${borderColor}` : '',
                            isRightEdge ? `inset -2px 0 0 0 ${borderColor}` : '',
                        ].filter(Boolean).join(', ') || undefined,
                    }) : {}),
                }}
                data-row={row}
                data-col={col}
                onMouseDown={(e) => handleCellMouseDown(row, col, e)}
                onDoubleClick={() => startEdit(row, col)}
                onContextMenu={(e) => handleContextMenu(row, col, e)}
            >
                {(!colHidden && !rowHidden) && (isEditing ? (
                    <input
                        ref={editInputRef}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => finishEdit(true)}
                        className="h-full w-full border-0 px-1 text-sm outline-none"
                        style={{
                            fontFamily: style.fontFamily || DEFAULT_FONT_FAMILY,
                            fontSize: `${style.fontSize || DEFAULT_FONT_SIZE}px`,
                        }}
                    />
                ) : (
                    renderCellContent(row, col)
                ))}

            </td>
        );
    };

    const renderRow = (rowIndex: number, options?: { isFrozen?: boolean; frozenTop?: number }) => {
        const cells: React.ReactNode[] = [];
        for (let c = 0; c < cols; c++) {
            const cell = renderCell(rowIndex, c, {isFrozen: options?.isFrozen, frozenTop: options?.frozenTop});
            if (cell) cells.push(cell);
        }
        const isRowHidden = hiddenRows.has(rowIndex);
        return (
            <tr key={rowIndex} style={isRowHidden ? {display: 'none'} : undefined}>
                <th
                    className={cn(
                        'sticky left-0 z-30 border-r border-b border-gray-200 bg-gray-100 text-center text-xs font-normal text-gray-600 select-none',
                        !isRowHidden && 'cursor-pointer hover:bg-gray-200',
                        isRowHidden && 'border-0',
                        !isRowHidden && (hiddenRowGroups.some((g) => g.start === rowIndex + 1) || hiddenRowGroups.some((g) => g.start === 0 && g.end === rowIndex - 1)) && 'z-40',
                        rowIndex >= rows - bottomFrozenRows && 'bottom-0 z-[28]',
                        options?.isFrozen && 'z-[38]',
                    )}
                    style={{
                        height: isRowHidden ? 0 : rowHeights[rowIndex],
                        width: ROW_HEADER_WIDTH,
                        minWidth: ROW_HEADER_WIDTH,
                        ...(options?.isFrozen && options?.frozenTop !== undefined ? {
                            top: options.frozenTop,
                            position: 'sticky'
                        } : {}),
                    }}
                    onMouseDown={(e) => !isRowHidden && handleRowHeaderMouseDown(rowIndex, e)}
                    onMouseEnter={() => !isRowHidden && handleRowHeaderMouseEnter(rowIndex)}
                    onContextMenu={(e) => !isRowHidden && handleHeaderContextMenu(e, 'row', rowIndex)}
                    title={isRowHidden ? '' : `${rowIndex + 1}`}
                >
                    {!isRowHidden && rowIndex + 1}
                    {!isRowHidden && hiddenRowGroups.some((g) => g.start === rowIndex + 1) && (
                        <div
                            className="absolute left-0 right-0 z-40 flex cursor-pointer items-center justify-center bg-slate-400 hover:bg-slate-500"
                            style={{bottom: '-6px', height: '12px'}}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleUnhideRow(rowIndex + 1);
                            }}
                            title="取消隐藏"
                        >
                            <ChevronsUpDown size={8} className="text-white"/>
                        </div>
                    )}
                    {!isRowHidden && hiddenRowGroups.some((g) => g.start === 0 && g.end === rowIndex - 1) && (
                        <div
                            className="absolute left-0 right-0 z-40 flex cursor-pointer items-center justify-center bg-slate-400 hover:bg-slate-500"
                            style={{top: '-6px', height: '12px'}}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleUnhideRow(0);
                            }}
                            title="取消隐藏"
                        >
                            <ChevronsUpDown size={8} className="text-white"/>
                        </div>
                    )}
                </th>
                {cells}
            </tr>
        );
    };

    return (
        <CellSelectionProvider
            selection={selection}
            cells={cells}
            merges={merges}
            hiddenRows={hiddenRows}
            hiddenCols={hiddenCols}
            cols={cols}
            rows={rows}
            extraCells={extraCells}
        >
            <div
                ref={wrapperRef}
                className={cn(
                    'flex flex-col overflow-hidden rounded-sm border border-border bg-white',
                    isFullscreen && 'h-screen w-screen rounded-none border-0',
                    className,
                )}
            >
                {/* Toolbar */}
                {!hideToolbar && (
                    <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 px-2 py-1.5">
                        <button
                            type="button"
                            onClick={handleUndo}
                            disabled={!historyRef.current.canUndo()}
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
                            title="撤销 (Ctrl+Z)"
                        >
                            <Undo2 size={14}/> 撤销
                        </button>
                        <button
                            type="button"
                            onClick={handleRedo}
                            disabled={!historyRef.current.canRedo()}
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
                            title="重做 (Ctrl+Y)"
                        >
                            <Redo2 size={14}/> 重做
                        </button>

                        <div className="mx-1 h-5 w-px bg-gray-300"/>

                        <select
                            value={activeCellStyle.fontFamily || DEFAULT_FONT_FAMILY}
                            onChange={(e) => applyStyleToSelection({fontFamily: e.target.value})}
                            className="h-7 rounded border border-gray-300 bg-white px-1 text-xs"
                        >
                            {FONT_FAMILIES.map((f) => (
                                <option key={f.label} value={f.value}>{f.label}</option>
                            ))}
                        </select>

                        <select
                            value={activeCellStyle.fontSize || DEFAULT_FONT_SIZE}
                            onChange={(e) => applyStyleToSelection({fontSize: Number(e.target.value)})}
                            className="h-7 w-16 rounded border border-gray-300 bg-white px-1 text-xs"
                        >
                            {FONT_SIZES.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>

                        <div className="mx-1 h-5 w-px bg-gray-300"/>

                        <button
                            type="button"
                            onClick={() => applyStyleToSelection({bold: !activeCellStyle.bold})}
                            className={cn('flex h-7 w-7 items-center justify-center rounded hover:bg-gray-200', activeCellStyle.bold && 'bg-gray-200 font-bold')}
                            title="加粗 (Ctrl+B)"
                        >
                            <Bold size={14}/>
                        </button>
                        <button
                            type="button"
                            onClick={() => applyStyleToSelection({italic: !activeCellStyle.italic})}
                            className={cn('flex h-7 w-7 items-center justify-center rounded hover:bg-gray-200', activeCellStyle.italic && 'bg-gray-200')}
                            title="斜体 (Ctrl+I)"
                        >
                            <Italic size={14}/>
                        </button>
                        <button
                            type="button"
                            onClick={() => applyStyleToSelection({underline: !activeCellStyle.underline})}
                            className={cn('flex h-7 w-7 items-center justify-center rounded hover:bg-gray-200', activeCellStyle.underline && 'bg-gray-200')}
                            title="下划线 (Ctrl+U)"
                        >
                            <Underline size={14}/>
                        </button>
                        <button
                            type="button"
                            onClick={() => applyStyleToSelection({strikethrough: !activeCellStyle.strikethrough})}
                            className={cn('flex h-7 w-7 items-center justify-center rounded hover:bg-gray-200', activeCellStyle.strikethrough && 'bg-gray-200')}
                            title="删除线 (Ctrl+Shift+X)"
                        >
                            <Strikethrough size={14}/>
                        </button>

                        <div className="mx-1 h-5 w-px bg-gray-300"/>

                        <label
                            className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded hover:bg-gray-200"
                            title="字体颜色">
          <span className="relative">
            <span className="text-xs font-bold" style={{color: activeCellStyle.color || '#000'}}>A</span>
            <span className="absolute -bottom-0.5 left-0 right-0 h-0.5"
                  style={{backgroundColor: activeCellStyle.color || '#e11d48'}}/>
          </span>
                            <input
                                type="color"
                                value={activeCellStyle.color || '#000000'}
                                onChange={(e) => applyStyleToSelection({color: e.target.value})}
                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            />
                        </label>

                        <label
                            className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded hover:bg-gray-200"
                            title="背景颜色">
                            <div className="size-4 border border-gray-400"
                                 style={{backgroundColor: activeCellStyle.bgColor || '#ffffff'}}/>
                            <input
                                type="color"
                                value={activeCellStyle.bgColor || '#ffffff'}
                                onChange={(e) => applyStyleToSelection({bgColor: e.target.value})}
                                className="absolute h-0 w-0 opacity-0"
                            />
                        </label>

                        <div className="mx-1 h-5 w-px bg-gray-300"/>

                        <button
                            type="button"
                            onClick={() => applyStyleToSelection({align: 'left'})}
                            className={cn('flex h-7 w-7 items-center justify-center rounded hover:bg-gray-200', activeCellStyle.align === 'left' && 'bg-gray-200')}
                            title="左对齐 (Ctrl+Shift+L)"
                        >
                            <AlignLeft size={14}/>
                        </button>
                        <button
                            type="button"
                            onClick={() => applyStyleToSelection({align: 'center'})}
                            className={cn('flex h-7 w-7 items-center justify-center rounded hover:bg-gray-200', activeCellStyle.align === 'center' && 'bg-gray-200')}
                            title="居中对齐 (Ctrl+Shift+E)"
                        >
                            <AlignCenter size={14}/>
                        </button>
                        <button
                            type="button"
                            onClick={() => applyStyleToSelection({align: 'right'})}
                            className={cn('flex h-7 w-7 items-center justify-center rounded hover:bg-gray-200', activeCellStyle.align === 'right' && 'bg-gray-200')}
                            title="右对齐 (Ctrl+Shift+R)"
                        >
                            <AlignRight size={14}/>
                        </button>

                        <div className="mx-1 h-5 w-px bg-gray-300"/>

                        <button
                            type="button"
                            onClick={handleMerge}
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-gray-200"
                            title="合并单元格"
                        >
                            <Merge size={14}/> 合并
                        </button>
                        <button
                            type="button"
                            onClick={handleUnmerge}
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-gray-200"
                            title="拆分单元格"
                        >
                            <Split size={14}/> 拆分
                        </button>

                        <div className="mx-1 h-5 w-px bg-gray-300"/>

                        <button
                            type="button"
                            onClick={() => {
                                const {minR, maxR, minC, maxC} = getSelectionRange();
                                const patch: Partial<CellStyle> = {};
                                for (let r = minR; r <= maxR; r++) {
                                    for (let c = minC; c <= maxC; c++) {
                                        const s = getCellStyle(r, c);
                                        const d = s.decimals ?? 2;
                                        patch.decimals = d + 1;
                                        break;
                                    }
                                    break;
                                }
                                applyStyleToSelection(patch);
                            }}
                            className="rounded px-2 py-1 text-xs hover:bg-gray-200"
                            title="增加小数位数"
                        >
                            .00+
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                const {minR, maxR, minC, maxC} = getSelectionRange();
                                const patch: Partial<CellStyle> = {};
                                for (let r = minR; r <= maxR; r++) {
                                    for (let c = minC; c <= maxC; c++) {
                                        const s = getCellStyle(r, c);
                                        const d = s.decimals ?? 2;
                                        patch.decimals = Math.max(0, d - 1);
                                        break;
                                    }
                                    break;
                                }
                                applyStyleToSelection(patch);
                            }}
                            className="rounded px-2 py-1 text-xs hover:bg-gray-200"
                            title="减少小数位数"
                        >
                            .00-
                        </button>

                        <div className="mx-1 h-5 w-px bg-gray-300"/>

                        <button
                            type="button"
                            onClick={() => {
                                setFindMode('find');
                                setFindReplaceOpen(true);
                            }}
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-gray-200"
                            title="查找 (Ctrl+F)"
                        >
                            <Search size={14}/> 查找替换
                        </button>

                        <div className="ml-auto text-xs text-gray-500">
                            {hasUserSelectedRef.current ? `${colIndexToLetter(selection.startCol)}${selection.startRow + 1}` : ''}
                        </div>
                    </div>
                )}

                {/* Spreadsheet grid */}
                <div
                    ref={containerRef}
                    className="relative overflow-auto select-none"
                    style={{maxHeight: '65vh', zoom: `${zoom}%`, overflowAnchor: 'none'}}
                >
                    <table style={{tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0}}>
                        <colgroup>
                            <col style={{width: ROW_HEADER_WIDTH}}/>
                            {colWidths.map((w, i) => (
                                <col key={i} style={{width: hiddenCols.has(i) ? 0 : w}}/>
                            ))}
                        </colgroup>
                        <thead>
                        <tr style={{height: COL_HEADER_HEIGHT}}>
                            <th className="sticky left-0 top-0 z-30 border-r border-b border-gray-200 bg-gray-100 text-xs font-normal text-gray-600"
                                style={{width: ROW_HEADER_WIDTH, minWidth: ROW_HEADER_WIDTH}}>
                            </th>
                            {Array.from({length: cols}, (_, i) => {
                                const isColHidden = hiddenCols.has(i);
                                const showRightIndicator = !isColHidden && hiddenColGroups.some((g) => g.start === i + 1);
                                const showLeftIndicator = !isColHidden && hiddenColGroups.some((g) => g.start === 0 && g.end === i - 1);
                                return (
                                    <th
                                        key={i}
                                        className={cn(
                                            'sticky top-0 border-r border-b border-gray-200 bg-gray-100 text-center text-xs font-normal text-gray-600 select-none',
                                            !isColHidden && 'cursor-pointer hover:bg-gray-200',
                                            isColHidden && 'border-0',
                                            (showRightIndicator || showLeftIndicator) && 'z-10',
                                            i < frozenCols ? 'z-[35]' : 'z-20',
                                        )}
                                        style={{
                                            width: isColHidden ? 0 : colWidths[i],
                                            minWidth: isColHidden ? 0 : colWidths[i],
                                            ...(i < frozenCols ? {left: frozenColLefts[i]} : {}),
                                            ...(i === frozenCols - 1 ? {boxShadow: '2px 0 4px rgba(0,0,0,0.08)'} : {}),
                                        }}
                                        onMouseDown={(e) => !isColHidden && handleColHeaderMouseDown(i, e)}
                                        onMouseEnter={() => !isColHidden && handleColHeaderMouseEnter(i)}
                                        onContextMenu={(e) => !isColHidden && handleHeaderContextMenu(e, 'col', i)}
                                        title={isColHidden ? '' : colIndexToLetter(i)}
                                    >
                                        {!isColHidden && colIndexToLetter(i)}
                                        {!isColHidden && (
                                            <div
                                                className="absolute top-0 right-0 bottom-0 z-30 cursor-col-resize hover:bg-primary/30"
                                                style={{width: '5px'}}
                                                onMouseDown={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    colResizeRef.current = {
                                                        col: i,
                                                        startX: e.clientX,
                                                        startWidth: colWidths[i]
                                                    };
                                                    document.body.style.cursor = 'col-resize';
                                                    document.body.style.userSelect = 'none';
                                                }}
                                            />
                                        )}
                                        {showRightIndicator && (
                                            <div
                                                className="absolute top-0 bottom-0 z-40 flex cursor-pointer items-center justify-center bg-slate-400 hover:bg-slate-500"
                                                style={{right: '-6px', width: '12px'}}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleUnhideCol(i + 1);
                                                }}
                                                title="取消隐藏"
                                            >
                                                <ChevronsLeftRight size={8} className="text-white"/>
                                            </div>
                                        )}
                                        {showLeftIndicator && (
                                            <div
                                                className="absolute top-0 bottom-0 z-40 flex cursor-pointer items-center justify-center bg-slate-400 hover:bg-slate-500"
                                                style={{left: '-6px', width: '12px'}}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleUnhideCol(0);
                                                }}
                                                title="取消隐藏"
                                            >
                                                <ChevronsLeftRight size={8} className="text-white"/>
                                            </div>
                                        )}
                                    </th>
                                );
                            })}
                        </tr>
                        </thead>
                        <tbody>
                        {frozenRows > 0 && (
                            Array.from({length: frozenRows}, (_, i) => renderRow(i, {
                                isFrozen: true,
                                frozenTop: frozenRowTops[i] + COL_HEADER_HEIGHT
                            }))
                        )}
                        {Array.from({length: rows - frozenRows - bottomFrozenRows}, (_, i) => renderRow(frozenRows + i))}
                        {bottomFrozenRows > 0 && (
                            Array.from({length: bottomFrozenRows}, (_, i) => renderRow(rows - bottomFrozenRows + i))
                        )}
                        </tbody>
                    </table>
                </div>

                {/* Bottom bar */}
                <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-3 py-1.5">
                    <div className="flex items-center gap-4 text-xs text-gray-600 min-w-0 flex-1">
                        {selectionStats && (
                            <>
              <span className="truncate">
                求和：<span className="font-mono font-medium text-gray-800">{selectionStats.sum.toLocaleString('zh-CN', {
                  maximumFractionDigits: 2,
                  minimumFractionDigits: 2
              })}</span>
              </span>
                                <span className="truncate">
                平均值：<span className="font-mono font-medium text-gray-800">{selectionStats.average.toLocaleString('zh-CN', {
                                    maximumFractionDigits: 2,
                                    minimumFractionDigits: 2
                                })}</span>
              </span>
                                <span className="truncate">
                计数：<span className="font-mono font-medium text-gray-800">{selectionStats.count}</span>
              </span>
                            </>
                        )}
                    </div>
                    {showAddRows !== false && (
                        <button
                            type="button"
                            onClick={() => addRows(200)}
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-200"
                        >
                            <Plus size={14}/> +200行
                        </button>
                    )}

                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={toggleFullscreen}
                            className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-200"
                            title={isFullscreen ? '退出全屏' : '全屏'}
                        >
                            {isFullscreen ? <Minimize2 size={14}/> : <Maximize2 size={14}/>}
                        </button>
                        <button
                            type="button"
                            onClick={handleZoomOut}
                            className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-200"
                        >
                            <Minus size={14}/>
                        </button>
                        <input
                            type="text"
                            value={`${zoom}%`}
                            onChange={(e) => {
                                const v = parseInt(e.target.value.replace('%', ''), 10);
                                if (!isNaN(v) && v >= 25 && v <= 400) setZoom(v);
                            }}
                            onBlur={(e) => {
                                const v = parseInt(e.target.value.replace('%', ''), 10);
                                if (isNaN(v) || v < 25) setZoom(25);
                                else if (v > 400) setZoom(400);
                            }}
                            className="h-6 w-14 rounded border border-gray-300 bg-white text-center text-xs"
                        />
                        <button
                            type="button"
                            onClick={handleZoomIn}
                            className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-200"
                        >
                            <Plus size={14}/>
                        </button>
                    </div>
                </div>

                <FindReplaceDialog
                    open={findReplaceOpen}
                    mode={findMode}
                    onClose={() => setFindReplaceOpen(false)}
                    onFindReplace={handleFindReplace}
                />

                {contextMenu && (
                    <ContextMenu
                        x={contextMenu.x}
                        y={contextMenu.y}
                        startRow={selection.startRow}
                        endRow={selection.endRow}
                        startCol={selection.startCol}
                        endCol={selection.endCol}
                        onClose={() => setContextMenu(null)}
                        onCopy={handleCopy}
                        onCopyAsImage={handleCopyAsImage}
                        onDeleteRows={handleDeleteRows}
                        onHideRows={handleHideRows}
                        onUnhideRows={handleUnhideRows}
                        onMerge={handleMerge}
                        onSelectAll={handleSelectAll}
                        hiddenRows={hiddenRows}
                    />
                )}

                {headerMenu && (
                    <div
                        className="fixed z-50 w-48 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
                        style={{left: headerMenu.x, top: headerMenu.y}}
                        onMouseDown={(e) => e.stopPropagation()}
                        onContextMenu={(e) => e.preventDefault()}
                    >
                        {headerMenu.type === 'col' ? (
                            <div
                                className="px-3 py-1.5 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer flex items-center gap-2"
                                onClick={() => {
                                    handleHideCols(headerMenu.startIdx, headerMenu.endIdx);
                                    setHeaderMenu(null);
                                }}
                            >
                                <EyeOff size={15}/>
                                隐藏第 {colIndexToLetter(headerMenu.startIdx)}{headerMenu.startIdx !== headerMenu.endIdx ? ` - ${colIndexToLetter(headerMenu.endIdx)}` : ''} 列
                            </div>
                        ) : (
                            <>
                                <div
                                    className="px-3 py-1.5 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer flex items-center gap-2"
                                    onClick={() => {
                                        handleHideRowsRange(headerMenu.startIdx, headerMenu.endIdx);
                                        setHeaderMenu(null);
                                    }}
                                >
                                    <EyeOff size={15}/>
                                    隐藏第 {headerMenu.startIdx + 1}{headerMenu.startIdx !== headerMenu.endIdx ? ` - ${headerMenu.endIdx + 1}` : ''} 行
                                </div>
                                {(() => {
                                    for (let r = headerMenu.startIdx; r <= headerMenu.endIdx; r++) {
                                        if (hiddenRows.has(r)) return true;
                                    }
                                    return false;
                                })() && (
                                    <div
                                        className="px-3 py-1.5 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer flex items-center gap-2"
                                        onClick={() => {
                                            handleUnhideRow(headerMenu.startIdx);
                                            setHeaderMenu(null);
                                        }}
                                    >
                                        <Eye size={15}/>
                                        取消隐藏此行
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </CellSelectionProvider>
    );
};

export default Spreadsheet;
