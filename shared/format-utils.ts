export function fmtInt(v: number | null | undefined): string {
    if (v === null || v === undefined || Number.isNaN(v)) return '—';
    return Math.round(v).toLocaleString('en-US');
}

export function fmtRate(v: number | null | undefined): string {
    if (v === null || v === undefined || Number.isNaN(v)) return '—';
    return v.toFixed(2);
}

export function fmtCtr(v: number | null | undefined): string {
    if (v === null || v === undefined || Number.isNaN(v)) return '—';
    const pct = v <= 1 ? v * 100 : v;
    return `${pct.toFixed(1)}%`;
}

export function fmtPct2(v: number | null | undefined): string {
    if (v === null || v === undefined || Number.isNaN(v)) return '—';
    const pct = v <= 1 ? v * 100 : v;
    return `${pct.toFixed(2)}%`;
}

export function fmtPct(v: number | null | undefined): string {
    if (v === null || v === undefined || Number.isNaN(v)) return '—';
    return `${(v * 100).toFixed(1)}%`;
}

export function fmtDateYMD(v: string | null | undefined): string {
    if (!v) return '—';
    const s = v.replace(/\//g, '-');
    const parts = s.split('-');
    if (parts.length !== 3) return v;
    const y = parts[0];
    const m = String(parseInt(parts[1], 10)).padStart(2, '0');
    const d = String(parseInt(parts[2], 10)).padStart(2, '0');
    if (y.length === 4) return `${y}/${m}/${d}`;
    return v;
}
