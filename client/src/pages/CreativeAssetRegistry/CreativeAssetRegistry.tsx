/**
 * 内审表信息入库页面（只读）
 *
 * 数据来源：后端 /api/creative-asset-registry/list（外部库 creative_asset_registry）
 * 本页面只做展示，不做同步、编辑
 */
import React, {useCallback, useEffect, useState} from 'react';
import {RefreshCw, Search} from 'lucide-react';
import {Button} from '@client/src/components/ui/button';
import {Input} from '@client/src/components/ui/input';
import {toast} from 'sonner';
import {
    listRecords,
    getFilterOptions,
    type RegistryRecord,
    type RegistryFilterOptions
} from '@client/src/api/creative-asset-registry';

const PAGE_SIZE = 50;

const CreativeAssetRegistry: React.FC = () => {
    const [items, setItems] = useState<RegistryRecord[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [options, setOptions] = useState<RegistryFilterOptions | null>(null);

    // 筛选条件
    const [country, setCountry] = useState('');
    const [week, setWeek] = useState('');
    const [auditStatus, setAuditStatus] = useState('');
    const [keyword, setKeyword] = useState('');

    /** 加载列表 */
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await listRecords({
                page,
                pageSize: PAGE_SIZE,
                country: country || undefined,
                week: week || undefined,
                auditStatus: auditStatus || undefined,
                keyword: keyword || undefined,
                sortField: 'materialDate',
                sortOrder: 'desc',
            });
            setItems(res.items);
            setTotal(res.total);
        } catch (err) {
            toast.error('加载内审表失败');
        } finally {
            setLoading(false);
        }
    }, [page, country, week, auditStatus, keyword]);

    /** 加载筛选项（一次性） */
    useEffect(() => {
        getFilterOptions()
            .then(setOptions)
            .catch(() => {
            });
    }, []);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <div className="flex flex-col gap-4">
            {/* 筛选栏 */}
            <div className="flex flex-wrap items-end gap-3 rounded-sm border border-border bg-card p-4">
                <div className="flex flex-col gap-1 min-w-[140px]">
                    <label className="text-xs text-muted-foreground">国家</label>
                    <select
                        value={country}
                        onChange={(e) => {
                            setCountry(e.target.value);
                            setPage(1);
                        }}
                        className="h-8 rounded border border-border bg-background px-2 text-xs"
                    >
                        <option value="">全部</option>
                        {options?.countries.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1 min-w-[140px]">
                    <label className="text-xs text-muted-foreground">周次</label>
                    <select
                        value={week}
                        onChange={(e) => {
                            setWeek(e.target.value);
                            setPage(1);
                        }}
                        className="h-8 rounded border border-border bg-background px-2 text-xs"
                    >
                        <option value="">全部</option>
                        {options?.weeks.map((w) => <option key={w} value={w}>{w}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1 min-w-[140px]">
                    <label className="text-xs text-muted-foreground">审核状态</label>
                    <select
                        value={auditStatus}
                        onChange={(e) => {
                            setAuditStatus(e.target.value);
                            setPage(1);
                        }}
                        className="h-8 rounded border border-border bg-background px-2 text-xs"
                    >
                        <option value="">全部</option>
                        {options?.auditStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1 min-w-[200px]">
                    <label className="text-xs text-muted-foreground">关键词</label>
                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"/>
                        <Input
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    setPage(1);
                                    void loadData();
                                }
                            }}
                            placeholder="素材名 / 身份ID"
                            className="h-8 pl-7 text-xs"
                        />
                    </div>
                </div>
                <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => void loadData()}
                        disabled={loading}>
                    <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`}/>
                    刷新
                </Button>
                <div className="ml-auto text-xs text-muted-foreground">
                    共 {total} 条
                </div>
            </div>

            {/* 表格 */}
            <div className="rounded-sm border border-border bg-card overflow-hidden">
                <div className="overflow-auto max-h-[calc(100vh-280px)]">
                    <table className="w-full text-xs">
                        <thead className="sticky top-0 z-10 border-b border-border bg-accent">
                        <tr>
                            <th className="px-3 py-2 text-left font-medium">素材名</th>
                            <th className="px-3 py-2 text-left font-medium">身份ID</th>
                            <th className="px-3 py-2 text-left font-medium">国家</th>
                            <th className="px-3 py-2 text-left font-medium">周次</th>
                            <th className="px-3 py-2 text-left font-medium">编导</th>
                            <th className="px-3 py-2 text-left font-medium">审核状态</th>
                            <th className="px-3 py-2 text-left font-medium">制作状态</th>
                            <th className="px-3 py-2 text-right font-medium">消耗</th>
                            <th className="px-3 py-2 text-right font-medium">展示</th>
                            <th className="px-3 py-2 text-right font-medium">点击</th>
                            <th className="px-3 py-2 text-right font-medium">转化</th>
                            <th className="px-3 py-2 text-left font-medium">制作日期</th>
                        </tr>
                        </thead>
                        <tbody>
                        {loading && items.length === 0 ? (
                            <tr>
                                <td colSpan={12} className="py-12 text-center text-muted-foreground">加载中...</td>
                            </tr>
                        ) : items.length === 0 ? (
                            <tr>
                                <td colSpan={12} className="py-12 text-center text-muted-foreground">暂无数据</td>
                            </tr>
                        ) : (
                            items.map((row) => (
                                <tr key={row.id} className="border-b border-border hover:bg-accent/50">
                                    <td className="px-3 py-1.5 truncate max-w-[280px]"
                                        title={row.finalName}>{row.finalName || row.initialName}</td>
                                    <td className="px-3 py-1.5 font-mono text-muted-foreground">{row.identityCardId || '—'}</td>
                                    <td className="px-3 py-1.5">{row.country || '—'}</td>
                                    <td className="px-3 py-1.5">{row.week || '—'}</td>
                                    <td className="px-3 py-1.5">{row.director || '—'}</td>
                                    <td className="px-3 py-1.5">{row.auditStatus || '—'}</td>
                                    <td className="px-3 py-1.5">{row.productionStatus || '—'}</td>
                                    <td className="px-3 py-1.5 text-right font-mono">{row.cost.toFixed(2)}</td>
                                    <td className="px-3 py-1.5 text-right font-mono">{row.impressions.toLocaleString()}</td>
                                    <td className="px-3 py-1.5 text-right font-mono">{row.clicks.toLocaleString()}</td>
                                    <td className="px-3 py-1.5 text-right font-mono">{row.conversions.toLocaleString()}</td>
                                    <td className="px-3 py-1.5">{row.materialDate || '—'}</td>
                                </tr>
                            ))
                        )}
                        </tbody>
                    </table>
                </div>

                {/* 分页 */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs">
            <span className="text-muted-foreground">
              第 {page} / {totalPages} 页
            </span>
                        <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="h-7" disabled={page <= 1}
                                    onClick={() => setPage(p => p - 1)}>上一页</Button>
                            <Button size="sm" variant="outline" className="h-7" disabled={page >= totalPages}
                                    onClick={() => setPage(p => p + 1)}>下一页</Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CreativeAssetRegistry;