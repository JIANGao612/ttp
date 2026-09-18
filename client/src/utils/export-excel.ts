import type {SheetData} from '@client/src/components/spreadsheet/types';
import {assertDownloadAllowed} from './export-guard';

export interface ExportColumn<T> {
    key?: keyof T;
    label: string;
    value?: (row: T) => string | number | null | undefined;
}

export interface ExportOptions {
    fileName?: string;
    sheetName?: string;
}

export interface AoaMerge {
    r1: number;
    c1: number;
    r2: number;
    c2: number;
}

function toCell(val: unknown): string | number {
    if (val === null || val === undefined) return '';
    if (typeof val === 'number') return val;
    return String(val);
}

export async function exportMultiSheetExcel(
    sheets: {
        aoa: (string | number)[][];
        sheetName: string;
        merges?: AoaMerge[];
        colWidths?: number[];
        hyperlink?: boolean
    }[],
    options?: ExportOptions,
): Promise<void> {
    if (!assertDownloadAllowed(options?.fileName ?? 'export.xlsx', 'xlsx')) return;
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    for (const sheet of sheets) {
        const ws = XLSX.utils.aoa_to_sheet(sheet.aoa);
        if (sheet.merges && sheet.merges.length > 0) {
            ws['!merges'] = sheet.merges.map((m) => ({
                s: {r: m.r1, c: m.c1},
                e: {r: m.r2, c: m.c2},
            }));
        }
        if (sheet.colWidths && sheet.colWidths.length > 0) {
            ws['!cols'] = sheet.colWidths.map((w) => ({wch: w}));
        }
        if (sheet.hyperlink && ws['!ref']) {
            const range = XLSX.utils.decode_range(ws['!ref']);
            for (let r = range.s.r; r <= range.e.r; r++) {
                for (let c = range.s.c; c <= range.e.c; c++) {
                    const addr = XLSX.utils.encode_cell({r, c});
                    const cell = ws[addr] as { v?: unknown; l?: { Target: string } } | undefined;
                    if (cell && typeof cell.v === 'string' && cell.v.startsWith('http')) {
                        cell.l = {Target: cell.v};
                    }
                }
            }
        }
        XLSX.utils.book_append_sheet(wb, ws, sheet.sheetName);
    }
    XLSX.writeFile(wb, options?.fileName ?? `export_${Date.now()}.xlsx`);
}

export async function exportToExcel<T extends object>(
    rows: T[],
    headers: ExportColumn<T>[],
    options?: ExportOptions,
): Promise<void> {
    if (!assertDownloadAllowed(options?.fileName ?? 'export.xlsx', 'xlsx')) return;
    const XLSX = await import('xlsx');
    const data = rows.map((row) => {
        const obj: Record<string, string | number> = {};
        for (const h of headers) {
            const raw: unknown = h.value ? h.value(row) : h.key !== undefined ? row[h.key] : undefined;
            obj[h.label] = toCell(raw);
        }
        return obj;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, options?.sheetName ?? 'Sheet1');
    XLSX.writeFile(wb, options?.fileName ?? `export_${Date.now()}.xlsx`);
}

export async function exportAoAToExcel(
    aoa: (string | number)[][],
    options?: ExportOptions & { merges?: AoaMerge[]; colWidths?: number[] },
): Promise<void> {
    if (!assertDownloadAllowed(options?.fileName ?? 'export.xlsx', 'xlsx')) return;
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    if (options?.merges && options.merges.length > 0) {
        ws['!merges'] = options.merges.map((m) => ({
            s: {r: m.r1, c: m.c1},
            e: {r: m.r2, c: m.c2},
        }));
    }
    if (options?.colWidths && options.colWidths.length > 0) {
        ws['!cols'] = options.colWidths.map((w) => ({wch: w}));
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, options?.sheetName ?? 'Sheet1');
    XLSX.writeFile(wb, options?.fileName ?? `export_${Date.now()}.xlsx`);
}

export async function exportSheetToExcel(
    sheet: SheetData,
    options?: ExportOptions & { hiddenRows?: number[]; hiddenCols?: number[] },
): Promise<void> {
    const hiddenRows = new Set(options?.hiddenRows ?? []);
    const hiddenCols = new Set(options?.hiddenCols ?? []);

    const rowMap = new Map<number, number>();
    let rowCount = 0;
    for (let i = 0; i < sheet.rows; i++) {
        if (!hiddenRows.has(i)) {
            rowMap.set(i, rowCount);
            rowCount++;
        }
    }
    const colMap = new Map<number, number>();
    let colCount = 0;
    for (let i = 0; i < sheet.cols; i++) {
        if (!hiddenCols.has(i)) {
            colMap.set(i, colCount);
            colCount++;
        }
    }

    const aoa: (string | number)[][] = Array.from({length: rowCount}, () =>
        Array.from({length: colCount}, () => '' as string | number),
    );
    sheet.cells.forEach((cell, key) => {
        const parts = key.split(',');
        const nr = rowMap.get(Number(parts[0]));
        const nc = colMap.get(Number(parts[1]));
        if (nr === undefined || nc === undefined) return;
        aoa[nr][nc] = cell.value;
    });

    const merges: AoaMerge[] = [];
    for (const m of sheet.merges) {
        const r1 = rowMap.get(m.row);
        const c1 = colMap.get(m.col);
        const r2 = rowMap.get(m.row + m.rowSpan - 1);
        const c2 = colMap.get(m.col + m.colSpan - 1);
        if (r1 === undefined || c1 === undefined || r2 === undefined || c2 === undefined) continue;
        merges.push({r1, c1, r2, c2});
    }

    await exportAoAToExcel(aoa, {...options, merges});
}
