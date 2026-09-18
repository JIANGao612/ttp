import React, {useCallback, useEffect, useState} from 'react';
import {TrendingUp, Target, DollarSign} from 'lucide-react';
import {Card} from '@client/src/components/ui/card';
import {Skeleton} from '@client/src/components/ui/skeleton';
import {logger} from '@client/src/utils/logger';
import {toast} from 'sonner';
import {getSummary} from '@client/src/api/ad-data';
import type {AdDataFilterParams, SummaryData} from '@shared/api.interface';

interface SummaryCardsProps {
    filters: AdDataFilterParams;
}

const SummaryCards: React.FC<SummaryCardsProps> = ({filters}) => {
    const [data, setData] = useState<SummaryData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const {data: result} = await getSummary(filters);
            setData(result);
        } catch (err) {
            logger.error('Failed to load summary:', err);
            toast.error('加载汇总数据失败');
            setData({totalCost: 0, totalConversions: 0, avgCost: null});
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    const cards = [
        {
            label: '总消耗',
            icon: DollarSign,
            display: data ? Math.round(data.totalCost).toLocaleString('en-US') : '—',
        },
        {
            label: '总付费量',
            icon: Target,
            display: data ? data.totalConversions.toLocaleString('en-US') : '—',
        },
        {
            label: '平均成本',
            icon: TrendingUp,
            display: data?.avgCost !== null && data?.avgCost !== undefined ? data.avgCost.toFixed(2) : '—',
        },
    ];

    return (
        <div
            data-ai-section-type="card-stat"
            className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
            {cards.map((card) => (
                <Card key={card.label} className="p-4">
                    <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {card.label}
            </span>
                        <card.icon className="size-4 text-muted-foreground"/>
                    </div>
                    {loading ? (
                        <Skeleton className="mt-3 h-8 w-32"/>
                    ) : (
                        <p className="mt-3 text-2xl font-semibold text-foreground tabular-nums"
                           style={{fontFamily: '"Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif'}}>
                            {card.display}
                        </p>
                    )}
                </Card>
            ))}
        </div>
    );
};

export default SummaryCards;
