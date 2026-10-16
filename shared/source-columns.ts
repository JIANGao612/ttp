import type {AdRecordFull} from './api.interface';
import {fmtInt, fmtDateYMD, fmtCost2} from './format-utils';

export interface SourceColumnDef {
    key: keyof AdRecordFull;
    label: string;
    format?: 'int' | 'rate' | 'date' | 'cost';
}

export const SOURCE_COLUMN_DEFS: SourceColumnDef[] = [
    {key: 'seriesName', label: '推广系列名称'},
    {key: 'campaignId', label: '推广系列ID'},
    {key: 'adGroupName', label: '广告组名称'},
    {key: 'creativeName', label: '创意素材名称'},
    {key: 'creativeId', label: '创意素材ID'},
    {key: 'videoMaterialId', label: '视频素材ID'},
    {key: 'adGroupId', label: '广告组ID'},
    {key: 'recordDate', label: '消耗时间', format: 'date'},
    {key: 'cleanedMaterialName', label: '清洗后素材名'},
    {key: 'cost', label: '消耗', format: 'cost'},
    {key: 'impressions', label: '展示量', format: 'int'},
    {key: 'clicks', label: '点击量（目标页面）', format: 'int'},
    {key: 'playCount', label: '播放数', format: 'int'},
    {key: 'play2s', label: '视频播放2秒次数', format: 'int'},
    {key: 'playComplete', label: '播放完成次数', format: 'int'},
    {key: 'avgVideoPlayDuration', label: '平均视频播放时长', format: 'rate'},
    {key: 'conversions', label: '付费量（网页）', format: 'int'},
    {key: 'cpaOriginal', label: 'CPA', format: 'rate'},
    {key: 'country', label: '国家'},
    {key: 'materialType', label: '素材类型'},
    {key: 'agent', label: '代理商'},
    {key: 'groupName', label: '组别'},
    {key: 'dateValue', label: '日期', format: 'date'},
    {key: 'materialCategory', label: '素材大类'},
    {key: 'newOrActive', label: '人群类型'},
    {key: 'newUserActivated', label: '新用户激活', format: 'int'},
    {key: 'placer', label: '投放人'},
    {key: 'bidType', label: '出价类型'},
    {key: 'materialDirection', label: '素材方向'},
    {key: 'bcDirection', label: 'B/C方向'},
    {key: 'materialDate', label: '素材制作日期', format: 'date'},
    {key: 'secondaryCategory', label: '二级分类（人群）'},
    {key: 'tertiaryCategory', label: '三级分类（方向）'},
    {key: 'creativeIdentityId', label: '创意身份ID'},
    {key: 'maxSettlementDate', label: '最大结算日期', format: 'date'},
    {key: 'nonSettlementCost', label: '不结算消耗', format: 'cost'},
];

export function orderGroupName(value: string | null | undefined): string {
    if (!value) return '';
    const parts = value.split('|').filter(Boolean);
    const delivery = parts.filter((p: string) => p.startsWith('投放'));
    const others = parts.filter((p: string) => !p.startsWith('投放'));
    return [...delivery, ...others].join('|');
}

export function formatSourceValue(def: SourceColumnDef, value: unknown): string | number {
    if (value === null || value === undefined || value === '') return '';
    if (def.key === 'groupName') return orderGroupName(String(value));
    if (def.format === 'int') return fmtInt(Number(value));
    if (def.format === 'cost') return fmtCost2(Number(value) || 0);
    if (def.format === 'rate') {
        const n = Number(value);
        return Number.isNaN(n) ? '—' : n.toFixed(2);
    }
    if (def.format === 'date') return fmtDateYMD(String(value));
    return typeof value === 'number' ? value : String(value);
}

/** 无 data_source 后端列对应的派生列（不参与关键词字段搜索） */
const COMPUTED_SOURCE_COLUMN_KEYS = new Set([
    'playCount',
    'play2s',
    'playComplete',
    'avgVideoPlayDuration',
    'cpaOriginal',
    'maxSettlementDate',
    'nonSettlementCost',
]);

/** 关键词「搜索字段」下拉选项（= data_source 表真实列，与后端 FIELD_MAP 一致） */
export const DATA_SOURCE_KEYWORD_FIELD_OPTIONS: { key: string; label: string }[] = SOURCE_COLUMN_DEFS
    .filter((def) => !COMPUTED_SOURCE_COLUMN_KEYS.has(def.key))
    .map((def) => ({key: def.key as string, label: def.label}));
