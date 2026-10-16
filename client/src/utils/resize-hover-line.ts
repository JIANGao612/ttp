const LINE_EDGE_PX = 6;

interface LineRange {
    top: number;
    bottom: number;
}

let lineEl: HTMLDivElement | null = null;
let lastRange: LineRange | null = null;
let initialized = false;

function ensureLine(): HTMLDivElement {
    if (lineEl && lineEl.isConnected) return lineEl;
    lineEl = document.createElement('div');
    lineEl.style.position = 'fixed';
    lineEl.style.width = '2px';
    lineEl.style.background = '#2563EB';
    lineEl.style.boxShadow = '0 0 4px rgba(37, 99, 235, 0.45)';
    lineEl.style.pointerEvents = 'none';
    lineEl.style.zIndex = '9998';
    lineEl.style.display = 'none';
    document.body.appendChild(lineEl);
    return lineEl;
}

function scrollContainerOf(table: HTMLElement): HTMLElement | null {
    let el: HTMLElement | null = table.parentElement;
    while (el && el !== document.body) {
        const {overflowY} = getComputedStyle(el);
        if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'hidden') return el;
        el = el.parentElement;
    }
    return null;
}

function verticalRange(table: HTMLElement): LineRange {
    const t = table.getBoundingClientRect();
    const container = scrollContainerOf(table);
    if (!container) return {top: t.top, bottom: t.bottom};
    const c = container.getBoundingClientRect();
    return {top: Math.max(t.top, c.top), bottom: Math.min(t.bottom, c.bottom)};
}

function showLine(x: number, range: LineRange): void {
    if (range.bottom - range.top < 8) return;
    lastRange = range;
    const el = ensureLine();
    el.style.left = `${Math.round(x) - 1}px`;
    el.style.top = `${Math.round(range.top)}px`;
    el.style.height = `${Math.round(range.bottom - range.top)}px`;
    el.style.display = 'block';
}

function hideLine(): void {
    if (lineEl) lineEl.style.display = 'none';
}

function handleMouseMove(e: MouseEvent): void {
    if (document.body.style.cursor === 'col-resize') {
        if (lastRange) showLine(e.clientX, lastRange);
        else hideLine();
        return;
    }
    const target = e.target instanceof Element ? e.target : null;
    if (!target) {
        hideLine();
        return;
    }
    const handle = target.closest('[class*="cursor-col-resize"]');
    if (handle) {
        const table = handle.closest('table');
        if (table && handle.closest('thead')) {
            const r = handle.getBoundingClientRect();
            showLine(r.right, verticalRange(table));
            return;
        }
    }
    const th = target.closest('th');
    if (th && th.closest('thead')) {
        const table = th.closest('table');
        if (
            table
            && !table.querySelector('thead [class*="cursor-col-resize"]')
            && !table.closest('[class*="ant-table"]')
        ) {
            const rect = th.getBoundingClientRect();
            if (
                Math.abs(e.clientX - rect.right) <= LINE_EDGE_PX
                && e.clientY >= rect.top
                && e.clientY <= rect.bottom
            ) {
                showLine(rect.right, verticalRange(table));
                return;
            }
        }
    }
    hideLine();
}

export function initResizeHoverLine(): void {
    if (initialized || typeof document === 'undefined') return;
    initialized = true;
    document.addEventListener('mousemove', handleMouseMove, {passive: true});
    window.addEventListener('blur', hideLine);
}
