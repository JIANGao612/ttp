import type {SelectionRange, SelectionStats} from './CellInteractionContext';
import {isNonMetricHeader} from '@client/src/utils/header-classify';

function cleanNumber(raw: string): number | null {
    const cleaned = raw.replace(/[\s,\$¥€£，%]/g, '');
    if (!cleaned) return null;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
}

function getHeaderLabels(tbody: HTMLElement): string[] {
    const table = tbody.closest('table');
    const headerRow = table?.querySelector('thead tr');
    if (!headerRow) return [];
    const labels: string[] = [];
    for (const cell of Array.from(headerRow.children)) {
        const colspan = Number(cell.getAttribute('colspan')) || 1;
        const text = cell.textContent?.trim() ?? '';
        for (let i = 0; i < colspan; i += 1) labels.push(text);
    }
    return labels;
}

export function computeSelectionStatsFromDOM(
    container: HTMLElement,
    ranges: SelectionRange[],
): SelectionStats | null {
    const tbody = container.querySelector('tbody');
    if (!tbody) return null;
    const rows = tbody.querySelectorAll('tr');
    const headerLabels = getHeaderLabels(tbody);

    const seen = new Set<string>();
    let sum = 0;
    let count = 0;

    for (const sel of ranges) {
        const minRow = Math.min(sel.startRow, sel.endRow);
        const maxRow = Math.max(sel.startRow, sel.endRow);
        const minCol = Math.min(sel.startCol, sel.endCol);
        const maxCol = Math.max(sel.startCol, sel.endCol);

        for (let r = minRow; r <= maxRow; r++) {
            const row = rows[r];
            if (!row) continue;
            const cells = row.querySelectorAll(':scope > td');
            for (let c = minCol; c <= maxCol; c++) {
                const key = `${r}:${c}`;
                if (seen.has(key)) continue;
                seen.add(key);
                const headerLabel = headerLabels[c] ?? '';
                if (headerLabel && isNonMetricHeader(headerLabel)) continue;
                const cell = cells[c];
                if (!cell) continue;
                const text = cell.textContent?.trim() ?? '';
                if (!text || text === '-' || text === '—' || text === 'N/A') continue;
                const num = cleanNumber(text);
                if (num !== null) {
                    sum += num;
                    count += 1;
                }
            }
        }
    }

    if (count === 0) return null;
    return {sum, count, average: sum / count};
}