import React, {useEffect, useState, useRef} from 'react';
import {logger} from '@client/src/utils/logger';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@client/src/components/ui/dialog';
import {getCountryMaterialDetail} from '@client/src/api/ad-data';
import type {CountryMaterialDetailRow} from '@shared/api.interface';
import {slotDisplayName} from '@shared/time-slot-schedule';
import {useColumnResizeDom} from '@client/src/hooks/use-column-resize-dom';

interface CountryMaterialDetailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    date: string;
    countryName: string;
    timeSlot?: string;
    group?: string[];
}

/**
 * 格式化日期。
 *
 * 中文说明：
 * 后端日期通常为 YYYY-MM-DD，
 * 弹窗中显示为 YYYY/MM/DD。
 */
function fmtDate(d: string): string {
    const parts = d.split('-');

    if (parts.length !== 3) {
        return d;
    }

    return `${parts[0]}/${parts[1]}/${parts[2]}`;
}

/**
 * 格式化消耗金额。
 *
 * 中文说明：
 * 金额统一显示美元符号，并保留两位小数。
 */
function fmtCost(v: number): string {
    return '$' + v.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

/**
 * 格式化百分比。
 *
 * 中文说明：
 * 后端返回的小数比例，例如 0.1234，
 * 页面显示为 12.34%。
 */
function fmtRate(v: number | null): string {
    if (v === null) {
        return '—';
    }

    return `${(v * 100).toFixed(2)}%`;
}

const CountryMaterialDetailDialog: React.FC<
    CountryMaterialDetailDialogProps
> = ({
         open,
         onOpenChange,
         date,
         countryName,
         timeSlot,
         group,
     }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [items, setItems] = useState<CountryMaterialDetailRow[]>([]);

    const scrollRef = useRef<HTMLDivElement>(null);

    useColumnResizeDom(scrollRef);

    /**
     * 弹窗打开后加载国家素材明细。
     *
     * 中文说明：
     * 当日期、国家、时报档位或分组发生变化时重新请求。
     * 弹窗关闭状态下不发起请求。
     */
    useEffect(() => {
        if (!open) {
            return;
        }

        setLoading(true);
        setError('');

        getCountryMaterialDetail({
            date,
            country: countryName,
            timeSlot,
            group,
        })
            .then((res) => {
                setItems(res.data.items);
            })
            .catch((err: unknown) => {
                logger.error(
                    'Failed to load country material detail:',
                    err,
                );

                setError('加载素材明细失败');
                setItems([]);
            })
            .finally(() => {
                setLoading(false);
            });
    }, [open, date, countryName, timeSlot, group]);

    /**
     * 计算当前明细中的总消耗。
     */
    const totalCost = items.reduce(
        (sum: number, item: CountryMaterialDetailRow) =>
            sum + item.cost,
        0,
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[70vw] max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>
                        {countryName} · {fmtDate(date)}
                        {timeSlot
                            ? ` · ${slotDisplayName(timeSlot)}`
                            : ''}{' '}
                        素材明细
                    </DialogTitle>
                </DialogHeader>

                <div
                    ref={scrollRef}
                    className="flex-1 overflow-auto"
                >
                    {loading ? (
                        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                            加载中...
                        </div>
                    ) : error ? (
                        <div className="flex h-40 items-center justify-center text-sm text-red-500">
                            {error}
                        </div>
                    ) : items.length === 0 ? (
                        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                            该国家当日无素材数据
                        </div>
                    ) : (
                        <table className="w-full border-collapse text-sm">
                            <thead className="sticky top-0 z-10">
                            <tr className="bg-accent text-xs text-muted-foreground">
                                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                                    序号
                                </th>

                                <th className="px-3 py-2 text-left font-semibold">
                                    清洗后素材名
                                </th>

                                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                                    消耗
                                </th>

                                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                                    点击率
                                </th>

                                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                                    2s播放率
                                </th>

                                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                                    完播率
                                </th>

                                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                                    转化率
                                </th>
                            </tr>
                            </thead>

                            <tbody>
                            {items.map(
                                (
                                    item: CountryMaterialDetailRow,
                                    idx: number,
                                ) => (
                                    <tr
                                        key={`${item.materialName}-${idx}`}
                                        className="border-b border-border hover:bg-accent/30"
                                    >
                                        <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">
                                            {idx + 1}
                                        </td>

                                        <td className="max-w-[360px] break-words px-3 py-2 text-xs">
                                            {item.materialName}
                                        </td>

                                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                                            {fmtCost(item.cost)}
                                        </td>

                                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                                            {fmtRate(item.ctr)}
                                        </td>

                                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                                            {fmtRate(item.play2sRate)}
                                        </td>

                                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                                            {fmtRate(
                                                item.playCompleteRate,
                                            )}
                                        </td>

                                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                                            {fmtRate(
                                                item.conversionRate,
                                            )}
                                        </td>
                                    </tr>
                                ),
                            )}

                            <tr className="bg-muted font-semibold">
                                <td
                                    className="px-3 py-2 text-xs"
                                    colSpan={2}
                                >
                                    合计（{items.length} 个素材）
                                </td>

                                <td className="px-3 py-2 text-right font-mono tabular-nums">
                                    {fmtCost(totalCost)}
                                </td>

                                <td
                                    className="px-3 py-2"
                                    colSpan={4}
                                />
                            </tr>
                            </tbody>
                        </table>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default CountryMaterialDetailDialog;