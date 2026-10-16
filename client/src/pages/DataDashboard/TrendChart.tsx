import React, {useCallback, useEffect, useState, useMemo, Suspense, lazy} from 'react';
import type {EChartsOption} from 'echarts';

const ReactECharts = lazy(() => import('echarts-for-react'));
import {BarChart3, ChevronDown} from 'lucide-react';
import {Empty, EmptyMedia, EmptyTitle, EmptyDescription} from '@client/src/components/ui/empty';
import {Skeleton} from '@client/src/components/ui/skeleton';
import {Button} from '@client/src/components/ui/button';
import {logger} from '@client/src/utils/logger';
import {toast} from 'sonner';
import {getTrend} from '@client/src/api/ad-data';
import type {AdDataFilterParams, TrendItem} from '@shared/api.interface';
import {cn} from '@/lib/utils';
import {useLoadMore} from '../shared/use-load-more';

interface TrendChartProps {
    filters: AdDataFilterParams;
}

type TrendScope = 'market' | 'self';

const VISIBLE_DAYS = 30;

const TrendChart: React.FC<TrendChartProps> = ({filters}) => {
    const [allItems, setAllItems] = useState<TrendItem[]>([]);
    const [selfItems, setSelfItems] = useState<TrendItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [activeScope, setActiveScope] = useState<TrendScope>('self');
    const [dataVersion, setDataVersion] = useState(0);
    const {extendedFilters, extraDays, loadMore, canLoadMore} = useLoadMore(filters);

    const fetchData = useCallback(async (f: AdDataFilterParams, isLoadMore: boolean) => {
        if (isLoadMore) setLoadingMore(true); else setLoading(true);
        try {
            const {data} = await getTrend(f);
            setAllItems(data.items);
            setSelfItems(data.selfItems);
            setDataVersion((v) => v + 1);
        } catch (err) {
            logger.error('Failed to load trend data:', err);
            toast.error('加载趋势数据失败');
            setAllItems([]);
            setSelfItems([]);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, []);

    useEffect(() => {
        void fetchData(extendedFilters, extraDays > 0);
    }, [fetchData, extendedFilters]);

    const currentItems = activeScope === 'self' ? selfItems : allItems;
    const hasData = allItems.length > 0 || selfItems.length > 0;

    const option = useMemo<EChartsOption>(() => {
        if (currentItems.length === 0) return {};

        const itemCount = currentItems.length;
        const startPercent = itemCount > VISIBLE_DAYS
            ? ((itemCount - VISIBLE_DAYS) / itemCount) * 100
            : 0;

        return {
            tooltip: {
                trigger: 'axis',
                valueFormatter: (value) => {
                    const num = Number(value);
                    if (num < 100) return num.toFixed(2);
                    return num.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                },
            },
            legend: {show: false},
            grid: {top: 30, left: 4, right: 4, bottom: 42, containLabel: true},
            xAxis: {
                type: 'category',
                data: currentItems.map((i) => i.date),
                axisLabel: {fontSize: 11, hideOverlap: true},
            },
            yAxis: [
                {
                    type: 'value',
                    name: '消耗',
                    axisLabel: {
                        fontSize: 11,
                        formatter: (v: number) => Number(v).toLocaleString('en-US', {maximumFractionDigits: 0})
                    },
                },
                {
                    type: 'value',
                    name: 'CPA',
                    min: 0,
                    axisLabel: {fontSize: 11, formatter: (v: number) => v.toFixed(0)},
                },
            ],
            dataZoom: [
                {
                    type: 'inside',
                    start: startPercent,
                    end: 100,
                    zoomOnMouseWheel: false,
                },
                {
                    type: 'slider',
                    start: startPercent,
                    end: 100,
                    height: 14,
                    bottom: 4,
                    brushSelect: false,
                },
            ],
            series: [
                {
                    name: '消耗',
                    type: 'bar',
                    data: currentItems.map((i) => i.cost),
                    itemStyle: {color: '#2258C4'},
                    barMaxWidth: 28,
                },
                {
                    name: 'CPA',
                    type: 'line',
                    yAxisIndex: 1,
                    data: currentItems.map((i) => i.cpa),
                    itemStyle: {color: '#2BAC6F'},
                    smooth: true,
                    symbolSize: 6,
                },
            ],
        };
    }, [currentItems]);

    return (
        <div className="rounded-sm border border-border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
                <h3 className="font-serif text-sm font-semibold text-foreground">消耗 / CPA 趋势</h3>
                <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
                    {(['self', 'market'] as const).map((scope) => (
                        <button
                            key={scope}
                            type="button"
                            onClick={() => setActiveScope(scope)}
                            className={cn(
                                'rounded-sm px-3 py-1 text-xs font-medium transition-colors',
                                activeScope === scope
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {scope === 'market' ? '大盘' : '自家'}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <Skeleton className="h-[300px] w-full"/>
            ) : !hasData ? (
                <Empty className="h-[300px] border-0">
                    <EmptyMedia variant="icon">
                        <BarChart3/>
                    </EmptyMedia>
                    <EmptyTitle>暂无趋势数据</EmptyTitle>
                    <EmptyDescription>请调整筛选条件或上传数据后查看</EmptyDescription>
                </Empty>
            ) : (
                <Suspense fallback={<Skeleton className="h-[300px] w-full"/>}>
                    <ReactECharts
                        key={`${activeScope}-${dataVersion}`}
                        option={option}
                        theme="ud"
                        className="h-[300px] w-full"
                    />
                </Suspense>
            )}
            {canLoadMore && (
                <div className="flex justify-center pt-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs text-muted-foreground"
                        onClick={loadMore}
                        disabled={loadingMore}
                    >
                        <ChevronDown className="size-3"/>
                        {loadingMore ? '加载中...' : extraDays > 0 ? `已加载近 ${14 + extraDays} 天，点击加载更多` : '加载更多历史数据'}
                    </Button>
                </div>
            )}
        </div>
    );
};

export default TrendChart;
