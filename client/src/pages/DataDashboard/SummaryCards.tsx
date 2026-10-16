import React, {useEffect, useState} from 'react';
import type {SummaryData, AdDataFilterParams} from '@shared/api.interface';
import {getSummary} from '@client/src/api/ad-data';
import {fmtCost2} from '@shared/format-utils';
import StatCard from '../shared/StatCard';

const fmtNum = (v: number): string => {
    if (v >= 100000000) return `${(v / 100000000).toFixed(1)}亿`;
    if (v >= 10000) return `${(v / 10000).toFixed(1)}万`;
    return v % 1 === 0 ? v.toLocaleString('en-US') : v.toFixed(1);
};

const fmtInt = (v: number): string => Math.round(v).toLocaleString('en-US');

const computeDays = (start?: string, end?: string): number | null => {
    if (!start || !end) return null;
    const diff = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
    return diff > 0 ? diff : null;
};

interface DeltaChipProps {
    pct: number;
}

const DeltaChip: React.FC<DeltaChipProps> = ({pct}) => {
    const cls =
        pct === 0
            ? 'bg-[#F3F4F6] text-[#6B7280]'
            : pct > 0
                ? 'bg-[#ECFDF5] text-[#10B981]'
                : 'bg-[#FEF2F2] text-[#EF4444]';
    const arrow = pct === 0 ? '—' : pct > 0 ? '▲' : '▼';
    return (
        <span
            className={`inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-xs font-medium tabular-nums ${cls}`}>
      {arrow} {Math.abs(pct).toFixed(1)}%
    </span>
    );
};

const SummaryCards: React.FC<{ filters: AdDataFilterParams }> = ({filters}) => {
    const [data, setData] = useState<SummaryData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        void fetchData();
    }, [filters]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const {data: res} = await getSummary(filters);
            setData(res);
        } catch (err) {
            setData({totalCost: 0, totalConversions: 0, avgCost: null, prevCost: null});
        } finally {
            setLoading(false);
        }
    };

    const days = computeDays(filters.investTimeStart, filters.investTimeEnd);
    const prevPct =
        data && data.prevCost !== null && data.prevCost > 0
            ? ((data.totalCost - data.prevCost) / data.prevCost) * 100
            : null;

    return (
        <div data-ai-section-type="card-stat" className="grid grid-cols-5 gap-2">
            <StatCard
                label="总消耗"
                loading={loading}
                value={data ? fmtCost2(data.totalCost) : '—'}
                sub={
                    prevPct !== null ? (
                        <span className="flex items-center gap-1">
              <DeltaChip pct={prevPct}/>
              环比上一周期
            </span>
                    ) : (
                        '环比 —'
                    )
                }
            />
            <StatCard
                label="总付费量"
                loading={loading}
                value={data ? fmtNum(data.totalConversions) : '—'}
                sub="当前筛选转化量"
            />
            <StatCard
                label="平均成本"
                loading={loading}
                value={data && data.avgCost !== null ? fmtCost2(data.avgCost) : '—'}
                sub="总消耗 ÷ 总付费量"
            />
            <StatCard
                label="日均消耗"
                loading={loading}
                value={data && days ? fmtCost2(data.totalCost / days) : '—'}
                sub={days ? `共 ${days} 天` : '选择时间范围后生效'}
            />
            <StatCard
                label="上期消耗"
                loading={loading}
                value={data && data.prevCost !== null ? fmtCost2(data.prevCost) : '—'}
                sub={days ? `前一等长周期（${days} 天）` : '选择时间范围后生效'}
            />
        </div>
    );
};

export default SummaryCards;
