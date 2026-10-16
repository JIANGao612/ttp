import {apiClient} from '@/utils/axios';
import type {
    RoiListParams,
    RoiListResponse,
    RoiSyncResponse,
    RoiSyncStatusResponse,
    RoiUpdateTaskStatus,
    RoiAgentOptionsResponse,
    RoiCountriesResponse,
    RoiMaterialTypesResponse,
    RoiPivotParams,
    RoiPivotResponse,
    RoiCountryRoiParams,
    RoiCountryRoiResponse,
} from '@shared/api.interface';

export function getRoiList(params: RoiListParams): Promise<RoiListResponse> {
    const {complianceStatus, ...rest} = params;
    const queryParams: Record<string, unknown> = {...rest};
    if (complianceStatus !== undefined && complianceStatus !== null) {
        const tierMap: Record<string, string> = {
            compliant: '1',
            warning: '2',
            non_compliant: '3',
            unknown: '4',
        };
        queryParams.roi_tier = tierMap[complianceStatus] ?? '';
    }
    return apiClient({
        url: '/roi-data/list',
        method: 'GET',
        params: queryParams,
        paramsSerializer: (params: Record<string, unknown>) => {
            const sp = new URLSearchParams();
            for (const [key, value] of Object.entries(params)) {
                if (value !== undefined && value !== null) {
                    sp.append(key, String(value));
                }
            }
            return sp.toString();
        },
    }).then((res) => res.data);
}

export function getRoiSyncStatus(): Promise<RoiSyncStatusResponse> {
    return apiClient({
        url: '/roi-data/sync-status',
        method: 'GET',
    }).then((res) => res.data);
}

export function syncRoiData(): Promise<RoiSyncResponse> {
    return apiClient({
        url: '/roi-data/sync',
        method: 'POST',
        timeout: 300000,
    }).then((res) => res.data);
}

export function updateRoiData(values: string[][]): Promise<RoiSyncResponse> {
    return apiClient({
        url: '/roi-data/update',
        method: 'POST',
        data: {values},
        timeout: 300000,
    }).then((res) => res.data);
}

// ⚠️ 注意：这是从飞书拉数据的老接口，脱离飞书后不可用。
// 若后端已删除 /api/roi-data/update-from-feishu 路由，请一并删掉此函数。
export function updateRoiDataFromFeishu(): Promise<RoiSyncResponse> {
    return apiClient({
        url: '/roi-data/update-from-feishu',
        method: 'POST',
        timeout: 60000,
    }).then((res) => res.data);
}

export function getRoiUpdateStatus(): Promise<RoiUpdateTaskStatus> {
    return apiClient({
        url: '/roi-data/update-status',
        method: 'GET',
    }).then((res) => res.data);
}

export function getRoiAgentOptions(): Promise<RoiAgentOptionsResponse> {
    return apiClient({
        url: '/roi-data/agents',
        method: 'GET',
    }).then((res) => res.data);
}

export function getRoiCountries(): Promise<RoiCountriesResponse> {
    return apiClient({
        url: '/roi-data/countries',
        method: 'GET',
    }).then((res) => res.data);
}

export function getRoiMaterialTypes(): Promise<RoiMaterialTypesResponse> {
    return apiClient({
        url: '/roi-data/material-types',
        method: 'GET',
    }).then((res) => res.data);
}

export function getRoiPivotData(
    params: RoiPivotParams,
): Promise<RoiPivotResponse> {
    return apiClient({
        url: '/roi-data/pivot',
        method: 'GET',
        params,
    }).then((res) => res.data);
}

export function getCountryRoiReport(
    params: RoiCountryRoiParams,
): Promise<RoiCountryRoiResponse> {
    return apiClient({
        url: '/roi-data/country-roi',
        method: 'GET',
        params,
    }).then((res) => res.data);
}