// TikTok 时报固定档位（已移除国庆 18:00 临时档位）。
// 内部档位键（存储 / 日志 / 拉数口径）= 业务档位名称：'12:00' | '16:00' | '22:00' | '24:00'；
// 页面展示统一为档位名称；仅「TikTok数据拉取-自动任务」展示实际开始执行时间。

export const AFTERNOON_SLOT: string = '16:00';

export const DAILY_TIME_SLOTS: string[] = ['12:00', '16:00', '22:00', '24:00'];

// 内部档位键 -> 实际开始执行时间（部分档位提前执行）。
export const SLOT_EXEC_TIME: Record<string, string> = {
    '12:00': '11:45',
    '16:00': '16:00',
    '22:00': '21:30',
    '24:00': '23:30',
};

export function slotExecTime(slot: string): string {
    return SLOT_EXEC_TIME[slot] ?? slot;
}

// 内部档位键 -> 页面展示名称（= 业务档位名称）。
export function slotDisplayName(slot: string): string {
    return slot;
}
