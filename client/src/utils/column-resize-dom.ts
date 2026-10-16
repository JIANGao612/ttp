import {onPrefUserChanged, userPrefKey} from './user-pref';
import {hydrateFromServer, localSet, prefSet} from './user-pref-sync';

const EDGE_PX = 6;
const MIN_WIDTH = 40;
const MAX_AUTOFIT_WIDTH = 480;
const AUTOFIT_PADDING = 10;
const MANAGED_ATTR = 'data-col-resize-managed';
const ROOT_ATTR = 'data-col-resize-root';
const LS_PREFIX = 'colw-dom';

const widthMaps = new Map<string, Record<number, number>>();
const hydratedScopes = new Set<string>();

interface EdgeTarget {
    table: HTMLTableElement;
    leafRow: HTMLTableRowElement;
    cellIndex: number;
}

function getLeafHeaderRow(table: HTMLTableElement): HTMLTableRowElement | null {
    const thead = table.tHead;
    if (!thead) return null;
    let best: HTMLTableRowElement | null = null;
    let bestCount = 0;
    Array.from(thead.rows).forEach((row: HTMLTableRowElement) => {
        const count = Array.from(row.cells).reduce(
            (acc: number, c: HTMLTableCellElement) => acc + c.colSpan,
            0,
        );
        if (count > bestCount) {
            bestCount = count;
            best = row;
        }
    });
    return best;
}

function hasNativeHandle(table: HTMLTableElement): boolean {
    return Boolean(table.querySelector('thead [class*="cursor-col-resize"]'));
}

function buildGrid(table: HTMLTableElement): HTMLTableCellElement[][] {
    const grid: HTMLTableCellElement[][] = [];
    Array.from(table.rows).forEach((row: HTMLTableRowElement, r: number) => {
        if (!grid[r]) grid[r] = [];
        let c = 0;
        Array.from(row.cells).forEach((cell: HTMLTableCellElement) => {
            while (grid[r][c]) c += 1;
            for (let dr = 0; dr < cell.rowSpan; dr += 1) {
                for (let dc = 0; dc < cell.colSpan; dc += 1) {
                    if (!grid[r + dr]) grid[r + dr] = [];
                    grid[r + dr][c + dc] = cell;
                }
            }
            c += cell.colSpan;
        });
    });
    return grid;
}

function gridColumnCount(table: HTMLTableElement): number {
    const grid = buildGrid(table);
    return grid.reduce((acc: number, row: HTMLTableCellElement[]) => Math.max(acc, row.length), 0);
}

function ensureColGroup(table: HTMLTableElement): HTMLElement[] | null {
    const colCount = gridColumnCount(table);
    if (colCount === 0) return null;
    let colgroup = table.querySelector(':scope > colgroup');
    if (colgroup) {
        const cols = colgroup.querySelectorAll('col');
        if (cols.length !== colCount) return null;
        return Array.from(cols) as HTMLElement[];
    }
    colgroup = document.createElement('colgroup');
    for (let i = 0; i < colCount; i += 1) {
        colgroup.appendChild(document.createElement('col'));
    }
    table.insertBefore(colgroup, table.firstChild);
    return Array.from(colgroup.children) as HTMLElement[];
}

function initColWidthsFromLeaf(
    table: HTMLTableElement,
    leafRow: HTMLTableRowElement,
    cols: HTMLElement[],
): void {
    if (table.hasAttribute(MANAGED_ATTR)) return;
    table.setAttribute(MANAGED_ATTR, '1');
    table.style.tableLayout = 'fixed';
    let cursor = 0;
    Array.from(leafRow.cells).forEach((cell: HTMLTableCellElement) => {
        const span = Math.min(cell.colSpan, cols.length - cursor);
        const width = cell.offsetWidth;
        const each = Math.max(1, Math.round(width / span));
        for (let i = 0; i < span; i += 1) {
            const col = cols[cursor + i];
            if (col && !col.style.width) col.style.width = `${each}px`;
        }
        cursor += span;
    });
}

function cellColRange(
    leafRow: HTMLTableRowElement,
    cellIndex: number,
): { start: number; end: number } {
    let cursor = 0;
    const cells = Array.from(leafRow.cells);
    for (let i = 0; i < cells.length; i += 1) {
        const span = cells[i].colSpan;
        if (i === cellIndex) return {start: cursor, end: cursor + span};
        cursor += span;
    }
    return {start: cellIndex, end: cellIndex + 1};
}

function collectColumnCells(
    table: HTMLTableElement,
    leafRow: HTMLTableRowElement,
    cellIndex: number,
): HTMLTableCellElement[] {
    const {start, end} = cellColRange(leafRow, cellIndex);
    const grid = buildGrid(table);
    const leafRowIndex = Array.from(table.rows).indexOf(leafRow);
    const found = new Set<HTMLTableCellElement>();
    grid.forEach((row: HTMLTableCellElement[], r: number) => {
        if (r < leafRowIndex) return;
        for (let c = start; c < end; c += 1) {
            const cell = row[c];
            if (cell) found.add(cell);
        }
    });
    return Array.from(found);
}

function measureCellsWidth(cells: HTMLTableCellElement[]): number {
    let max = MIN_WIDTH;
    cells.forEach((cell: HTMLTableCellElement) => {
        const prev = cell.style.whiteSpace;
        cell.style.whiteSpace = 'nowrap';
        if (cell.scrollWidth > max) max = cell.scrollWidth;
        cell.style.whiteSpace = prev;
    });
    return Math.min(max + AUTOFIT_PADDING, MAX_AUTOFIT_WIDTH);
}

function locateEdge(e: MouseEvent): EdgeTarget | null {
    const target = e.target instanceof Element ? e.target.closest('th, td') : null;
    if (!target || !target.closest('thead')) return null;
    const table = target.closest('table');
    if (!table || hasNativeHandle(table)) return null;
    if (table.closest('[class*="ant-table"]')) return null;
    const rect = target.getBoundingClientRect();
    if (Math.abs(e.clientX - rect.right) > EDGE_PX) return null;
    if (e.clientY < rect.top || e.clientY > rect.bottom) return null;
    const leafRow = getLeafHeaderRow(table);
    if (!leafRow) return null;
    const cellIndex = Array.from(leafRow.cells).indexOf(target as HTMLTableCellElement);
    if (cellIndex < 0) return null;
    return {table, leafRow, cellIndex};
}

export function measureColumnAutoFit(
    table: HTMLTableElement,
    headerCell: HTMLElement,
): number {
    const leafRow = getLeafHeaderRow(table);
    const headerRow = headerCell.parentElement as HTMLTableRowElement | null;
    const row = leafRow ?? headerRow;
    if (!row) return MIN_WIDTH;
    const cellIndex = Array.from(row.cells).indexOf(headerCell as HTMLTableCellElement);
    if (cellIndex < 0) return MIN_WIDTH;
    const cells = collectColumnCells(table, row, cellIndex);
    return measureCellsWidth(cells);
}

export function autoFitFromHandleEvent(
    currentTarget: EventTarget | null,
    onAutoFit?: (width: number) => void,
): void {
    if (!onAutoFit || !(currentTarget instanceof HTMLElement)) return;
    const th = currentTarget.closest('th');
    const table = currentTarget.closest('table');
    if (!th || !table) return;
    onAutoFit(measureColumnAutoFit(table, th));
}

function tableIndex(table: HTMLTableElement): number {
    const root = table.closest(`[${ROOT_ATTR}]`) ?? document.body;
    return Array.from(root.querySelectorAll('table')).indexOf(table);
}

function storeKey(table: HTMLTableElement, cellIndex: number): string {
    return userPrefKey(`${LS_PREFIX}:${location.pathname}:${tableIndex(table)}:${cellIndex}`);
}

function mapScope(table: HTMLTableElement): string {
    return `${LS_PREFIX}:${location.pathname}:${tableIndex(table)}`;
}

function mapMirrorKey(table: HTMLTableElement): string {
    return userPrefKey(`${LS_PREFIX}-map:${location.pathname}:${tableIndex(table)}`);
}

function loadWidth(table: HTMLTableElement, cellIndex: number): number | null {
    try {
        const raw = localStorage.getItem(storeKey(table, cellIndex));
        const parsed = raw ? Number(raw) : NaN;
        return Number.isFinite(parsed) && parsed >= MIN_WIDTH ? parsed : null;
    } catch {
        return null;
    }
}

function saveWidth(table: HTMLTableElement, cellIndex: number, width: number): void {
    const rounded: number = Math.round(width);
    try {
        localStorage.setItem(storeKey(table, cellIndex), String(rounded));
    } catch {
        /* quota exceeded, ignore */
    }
    const scope: string = mapScope(table);
    const map: Record<number, number> = widthMaps.get(scope) ?? {};
    map[cellIndex] = rounded;
    widthMaps.set(scope, map);
    const raw: string = JSON.stringify(map);
    localSet(mapMirrorKey(table), raw);
    prefSet(scope, raw);
}

function hydrateTableFromServer(table: HTMLTableElement, leafRow: HTMLTableRowElement): void {
    const scope: string = mapScope(table);
    if (hydratedScopes.has(scope)) return;
    hydratedScopes.add(scope);
    hydrateFromServer(scope, mapMirrorKey(table), (raw: string) => {
        let serverMap: Record<string, unknown>;
        try {
            serverMap = JSON.parse(raw) as Record<string, unknown>;
        } catch {
            return;
        }
        Object.keys(serverMap).forEach((key: string) => {
            const cellIndex: number = Number(key);
            const width: number = Number(serverMap[key]);
            if (!Number.isInteger(cellIndex) || cellIndex < 0) return;
            if (!Number.isFinite(width) || width < MIN_WIDTH) return;
            if (loadWidth(table, cellIndex) !== null) return;
            const cols = ensureColGroup(table);
            if (!cols) return;
            initColWidthsFromLeaf(table, leafRow, cols);
            const {start, end} = cellColRange(leafRow, cellIndex);
            const span: number = end - start;
            const each: number = Math.max(MIN_WIDTH, Math.round(width / span));
            for (let c = start; c < end; c += 1) {
                const col = cols[c];
                if (col) col.style.width = `${each}px`;
            }
            saveWidth(table, cellIndex, width);
        });
    });
}

function applyStoredWidths(container: HTMLElement): void {
    Array.from(container.querySelectorAll('table')).forEach((table: HTMLTableElement) => {
        if (hasNativeHandle(table)) return;
        const leafRow = getLeafHeaderRow(table);
        if (!leafRow) return;
        const scope: string = mapScope(table);
        const map: Record<number, number> = widthMaps.get(scope) ?? {};
        const pending: Array<{ cellIndex: number; width: number }> = [];
        Array.from(leafRow.cells).forEach((_: HTMLTableCellElement, i: number) => {
            const width = loadWidth(table, i);
            if (width !== null) {
                pending.push({cellIndex: i, width});
                map[i] = width;
            }
        });
        widthMaps.set(scope, map);
        hydrateTableFromServer(table, leafRow);
        if (pending.length === 0) return;
        const cols = ensureColGroup(table);
        if (!cols) return;
        initColWidthsFromLeaf(table, leafRow, cols);
        pending.forEach(({cellIndex, width}: { cellIndex: number; width: number }) => {
            const {start, end} = cellColRange(leafRow, cellIndex);
            const span = end - start;
            const each = Math.max(MIN_WIDTH, Math.round(width / span));
            for (let c = start; c < end; c += 1) {
                const col = cols[c];
                if (col) col.style.width = `${each}px`;
            }
        });
    });
}

interface DragState {
    cols: HTMLElement[];
    colStart: number;
    colEnd: number;
    startX: number;
    startWidths: number[];
    table: HTMLTableElement;
    cellIndex: number;
}

export function createColumnResizeDom(container: HTMLElement): () => void {
    container.setAttribute(ROOT_ATTR, '1');
    let drag: DragState | null = null;
    let hoverTh: HTMLElement | null = null;
    let applyTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleApply = (): void => {
        if (applyTimer) clearTimeout(applyTimer);
        applyTimer = setTimeout(() => applyStoredWidths(container), 200);
    };

    const setHover = (th: HTMLElement | null): void => {
        if (hoverTh === th) return;
        if (hoverTh) hoverTh.style.cursor = '';
        hoverTh = th;
        if (hoverTh) hoverTh.style.cursor = 'col-resize';
    };

    const handleMouseMove = (e: MouseEvent): void => {
        if (drag) return;
        const target = locateEdge(e);
        setHover(target ? (e.target as Element).closest('th, td') as HTMLElement : null);
    };

    const handleDragMove = (e: MouseEvent): void => {
        if (!drag) return;
        const delta = e.clientX - drag.startX;
        const total = Math.max(MIN_WIDTH, drag.startWidths.reduce((a: number, b: number) => a + b, 0) + delta);
        const span = drag.colEnd - drag.colStart;
        const each = Math.max(1, Math.round(total / span));
        for (let c = drag.colStart; c < drag.colEnd; c += 1) {
            const col = drag.cols[c];
            if (col) col.style.width = `${each}px`;
        }
    };

    const handleDragEnd = (): void => {
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        if (!drag) return;
        const {cols, colStart, colEnd, table, cellIndex} = drag;
        let total = 0;
        for (let c = colStart; c < colEnd; c += 1) {
            total += parseFloat(cols[c]?.style.width || '0') || 0;
        }
        saveWidth(table, cellIndex, total);
        drag = null;
    };

    const handleMouseDown = (e: MouseEvent): void => {
        if (e.button !== 0) return;
        const target = locateEdge(e);
        if (!target) return;
        const cols = ensureColGroup(target.table);
        if (!cols) return;
        initColWidthsFromLeaf(target.table, target.leafRow, cols);
        const {start, end} = cellColRange(target.leafRow, target.cellIndex);
        e.preventDefault();
        e.stopPropagation();
        const startWidths: number[] = [];
        for (let c = start; c < end; c += 1) {
            startWidths.push(parseFloat(cols[c]?.style.width || '0') || MIN_WIDTH);
        }
        drag = {
            cols,
            colStart: start,
            colEnd: end,
            startX: e.clientX,
            startWidths,
            table: target.table,
            cellIndex: target.cellIndex,
        };
        setHover(null);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragEnd);
    };

    const handleDblClick = (e: MouseEvent): void => {
        const target = locateEdge(e);
        if (!target) return;
        e.preventDefault();
        e.stopPropagation();
        const cells = collectColumnCells(target.table, target.leafRow, target.cellIndex);
        const width = measureCellsWidth(cells);
        const cols = ensureColGroup(target.table);
        if (!cols) return;
        initColWidthsFromLeaf(target.table, target.leafRow, cols);
        const {start, end} = cellColRange(target.leafRow, target.cellIndex);
        const each = Math.max(MIN_WIDTH, Math.round(width / (end - start)));
        for (let c = start; c < end; c += 1) {
            const col = cols[c];
            if (col) col.style.width = `${each}px`;
        }
        saveWidth(target.table, target.cellIndex, width);
    };

    const observer = new MutationObserver((mutations: MutationRecord[]) => {
        const structural = mutations.some((m: MutationRecord) =>
            Array.from(m.addedNodes).some((n: Node) => {
                if (!(n instanceof Element)) return false;
                return n.matches('table, thead, tbody, tr') || n.querySelector('table') !== null;
            }),
        );
        if (structural) scheduleApply();
    });

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mousedown', handleMouseDown, true);
    container.addEventListener('dblclick', handleDblClick, true);
    observer.observe(container, {childList: true, subtree: true});
    applyStoredWidths(container);

    const reapplyForUser = (): void => {
        Array.from(container.querySelectorAll('table')).forEach((table: HTMLTableElement) => {
            table.removeAttribute(MANAGED_ATTR);
            Array.from(table.querySelectorAll(':scope > colgroup > col')).forEach((col: Element) => {
                (col as HTMLElement).style.width = '';
            });
        });
        applyStoredWidths(container);
    };
    const offUserChanged = onPrefUserChanged(reapplyForUser);

    return () => {
        offUserChanged();
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mousedown', handleMouseDown, true);
        container.removeEventListener('dblclick', handleDblClick, true);
        observer.disconnect();
        if (applyTimer) clearTimeout(applyTimer);
        setHover(null);
    };
}
