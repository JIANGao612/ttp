import {toast} from 'sonner';
import {apiClient} from '@client/src/utils/axios';
import {logger} from '@client/src/utils/logger';

const AUTH_WINDOW_MS = 30 * 1000;
const TRACE_KEY = 'download_trace_log';
const TRACE_MAX = 30;

interface ExportClickRecord {
    ts: number;
    trusted: boolean;
    label: string;
}

let lastExportClick: ExportClickRecord | null = null;
let preAuthorized = false;

if (typeof document !== 'undefined') {
    document.addEventListener(
        'click',
        (e: MouseEvent) => {
            const target = e.target as HTMLElement | null;
            const trigger = target?.closest('button, a, [role="button"]');
            if (!trigger) return;
            const label = (trigger.textContent ?? '').trim();
            if (!label.includes('导出') && !label.includes('下载')) return;
            lastExportClick = {ts: Date.now(), trusted: e.isTrusted, label};
        },
        true,
    );
}

export interface DownloadTrace {
    ts: number;
    file: string;
    sink: string;
    authorized: boolean;
    click: ExportClickRecord | null;
    stack: string;
}

function recordTrace(trace: DownloadTrace): void {
    try {
        const raw = localStorage.getItem(TRACE_KEY);
        const list: DownloadTrace[] = raw ? (JSON.parse(raw) as DownloadTrace[]) : [];
        list.push(trace);
        localStorage.setItem(TRACE_KEY, JSON.stringify(list.slice(-TRACE_MAX)));
    } catch {
        // localStorage 不可用时仅上报服务端
    }
    apiClient.post('/api/ad-data/diagnostic/download-trace', trace).catch(() => undefined);
}

export function authorizeExport(): void {
    preAuthorized = true;
}

export function resetExportAuth(): void {
    lastExportClick = null;
    preAuthorized = false;
}

export function assertDownloadAllowed(file: string, sink: string): boolean {
    if (preAuthorized) {
        preAuthorized = false;
        return true;
    }
    const now = Date.now();
    const authorized =
        !!lastExportClick && lastExportClick.trusted && now - lastExportClick.ts <= AUTH_WINDOW_MS;
    if (authorized) {
        lastExportClick = null;
        return true;
    }

    const stack = (new Error().stack ?? '')
        .split('\n')
        .slice(1, 6)
        .map((line: string) => line.trim())
        .join(' | ');
    logger.error(`Blocked non-user download: file=${file} sink=${sink} stack=${stack}`);
    recordTrace({ts: now, file, sink, authorized, click: lastExportClick, stack});
    toast.error('检测到非用户点击触发的下载，已拦截；如需导出请使用导出按钮');
    return false;
}
