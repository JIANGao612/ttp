/**
 * useColumnWidths —— 表格列宽管理 Hook（脱离妙搭版）
 *
 * 相对飞书版本的改动：
 *  - 移除 useCurrentUserProfile（改用固定 LOCAL_USER_ID）
 *  - 移除后端 API（loadColWidths / saveColWidths / resetColWidths），纯 localStorage
 *  - 保留 useColumnWidthsRecord（Record<string, number> 形式）
 *
 * 对外接口（与飞书版一致）：
 *   useColumnWidths(defaultWidths, tableId) → {
 *     widths, startResize, handleResizeEnd, setColumnWidth, reset
 *   }
 *   useColumnWidthsRecord(defaultWidths, tableId) → { widths, setColWidth, reset }
 */
import {useCallback, useEffect, useRef, useState} from 'react';

// ============================================================
// 常量
// ============================================================
const LS_PREFIX = 'col-widths';
const LOCAL_USER_ID = 'local-dev';   // 本地开发无用户系统
const MIN_WIDTH = 40;
const MAX_WIDTH = 2000;

// ============================================================
// localStorage 工具
// ============================================================
function lsKey(userId: string, tableId: string): string {
    return `${LS_PREFIX}:${userId}:${tableId}`;
}

function readLs(userId: string, tableId: string): number[] | null {
    try {
        const raw = localStorage.getItem(lsKey(userId, tableId));
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed as number[];
        }
    } catch { /* ignore */
    }
    return null;
}

function writeLs(userId: string, tableId: string, widths: number[]): void {
    try {
        localStorage.setItem(lsKey(userId, tableId), JSON.stringify(widths));
    } catch { /* quota exceeded, ignore */
    }
}

function readLsRecord(userId: string, tableId: string): Record<string, number> | null {
    try {
        const raw = localStorage.getItem(lsKey(userId, tableId));
        if (raw) {
            const parsed = JSON.parse(raw);
            if (typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed as Record<string, number>;
            }
        }
    } catch { /* ignore */
    }
    return null;
}

function writeLsRecord(userId: string, tableId: string, widths: Record<string, number>): void {
    try {
        localStorage.setItem(lsKey(userId, tableId), JSON.stringify(widths));
    } catch { /* ignore */
    }
}

// ============================================================
// number[] API（被约 31 个页面使用）
// ============================================================
export interface UseColumnWidthsResult {
    widths: number[];
    startResize: (colIdx: number, clientX: number) => void;
    handleResizeEnd: () => void;
    setColumnWidth: (colIdx: number, width: number) => void;
    reset: () => void;
}

export function useColumnWidths(
    defaultWidths: number[],
    tableId?: string,
): UseColumnWidthsResult {
    const userId = LOCAL_USER_ID;

    const [widths, setWidths] = useState<number[]>(() => {
        if (tableId) {
            const cached = readLs(userId, tableId);
            if (cached && cached.length === defaultWidths.length) {
                return cached;
            }
        }
        return defaultWidths;
    });

    const prevDefaultLenRef = useRef(defaultWidths.length);

    /** 列数变化时重置为默认宽度 */
    useEffect(() => {
        if (defaultWidths.length !== prevDefaultLenRef.current) {
            prevDefaultLenRef.current = defaultWidths.length;
            setWidths(defaultWidths);
        }
    }, [defaultWidths]);

    /** 列宽变化时同步写 localStorage */
    useEffect(() => {
        if (!tableId) return;
        writeLs(userId, tableId, widths);
    }, [widths, tableId, userId]);

    /** 恢复默认列宽 */
    const reset = useCallback(() => {
        setWidths(defaultWidths);
        if (tableId) {
            try {
                localStorage.removeItem(lsKey(userId, tableId));
            } catch { /* ignore */
            }
        }
    }, [defaultWidths, tableId, userId]);

    /** 拖拽结束（本版本已由 effect 自动持久化，无需额外动作） */
    const handleResizeEnd = useCallback(() => {
        /* 列宽通过上面的 effect 自动持久化，无需操作 */
    }, []);

    /** 拖拽调整列宽 */
    const startResize = useCallback(
        (colIdx: number, clientX: number) => {
            const startWidth = widths[colIdx];

            const handleMouseMove = (e: MouseEvent) => {
                const delta = e.clientX - clientX;
                setWidths((prev) => {
                    const next = [...prev];
                    next[colIdx] = Math.max(
                        MIN_WIDTH,
                        Math.min(MAX_WIDTH, startWidth + delta),
                    );
                    return next;
                });
            };

            const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            };

            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        },
        [widths],
    );

    /** 双击表头"自动适应宽度"时调用 */
    const setColumnWidth = useCallback((colIdx: number, width: number) => {
        setWidths((prev) => {
            const safe = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(width)));
            if (prev[colIdx] === safe) return prev;
            const next = [...prev];
            next[colIdx] = safe;
            return next;
        });
    }, []);

    return {widths, startResize, handleResizeEnd, setColumnWidth, reset};
}

// ============================================================
// Record<string, number> API
// ============================================================
export interface UseColumnWidthsRecordResult {
    widths: Record<string, number>;
    setColWidth: (key: string, width: number) => void;
    reset: () => void;
}

export function useColumnWidthsRecord(
    defaultWidths: Record<string, number>,
    tableId?: string,
): UseColumnWidthsRecordResult {
    const userId = LOCAL_USER_ID;

    const [widths, setWidths] = useState<Record<string, number>>(() => {
        if (tableId) {
            const cached = readLsRecord(userId, tableId);
            if (cached) {
                return {...defaultWidths, ...cached};
            }
        }
        return {...defaultWidths};
    });

    /** 列宽变化时同步写 localStorage */
    useEffect(() => {
        if (!tableId) return;
        writeLsRecord(userId, tableId, widths);
    }, [widths, tableId, userId]);

    const setColWidth = useCallback((key: string, width: number) => {
        const safeWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(width)));
        setWidths((prev) => {
            if (prev[key] === safeWidth) return prev;
            return {...prev, [key]: safeWidth};
        });
    }, []);

    const reset = useCallback(() => {
        setWidths({...defaultWidths});
        if (tableId) {
            try {
                localStorage.removeItem(lsKey(userId, tableId));
            } catch { /* ignore */
            }
        }
    }, [defaultWidths, tableId, userId]);

    return {widths, setColWidth, reset};
}