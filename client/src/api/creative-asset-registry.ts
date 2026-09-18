import {apiClient} from '@client/src/utils/axios';
import type {
    RegistrySyncTaskResponse,
    RegistrySyncStatusResponse,
    RegistryListParams,
    RegistryListResponse,
    RegistryFunctionListResponse,
    DimensionListResponse,
    DimensionRecordsListResponse,
    DimensionRecordsListParams,
    RegistryFilterOptions,
} from '@shared/api.interface';

export async function syncFromBitable(): Promise<RegistrySyncTaskResponse> {
    const res = await apiClient.post<RegistrySyncTaskResponse>(
        '/creative-asset-registry/sync',
    );
    return res.data;
}

export async function getSyncStatus(
    taskId: string,
): Promise<RegistrySyncStatusResponse | null> {
    const res = await apiClient.get<RegistrySyncStatusResponse | null>(
        '/creative-asset-registry/sync-status',
        {params: {taskId}},
    );
    return res.data;
}

export async function backfillIdentityId(): Promise<{ taskId: string }> {
    const res = await apiClient.post<{ taskId: string }>(
        '/data-upload/backfill-identity-id',
        {},
    );
    return res.data;
}

export async function getBackfillStatus(taskId: string): Promise<{
    status: string;
    startedAt: number;
    result?: { total: number; recleaned: number; rematched: number; updated: number; refreshed: number };
    error?: string;
} | null> {
    const res = await apiClient.get<{
        status: string;
        startedAt: number;
        result?: { total: number; recleaned: number; rematched: number; updated: number; refreshed: number };
        error?: string;
    } | null>(
        '/data-upload/backfill-identity-id/status',
        {params: {taskId}},
    );
    return res.data;
}

export async function listRecords(
    params: RegistryListParams,
): Promise<RegistryListResponse> {
    const res = await apiClient.get<RegistryListResponse>(
        '/creative-asset-registry/list',
        {
            params: {
                ...params,
                country: params.country || undefined,
                filters: params.filters ? JSON.stringify(params.filters) : undefined,
            },
        },
    );
    return res.data;
}

export async function listByFunction(
    country?: string,
): Promise<RegistryFunctionListResponse> {
    const res = await apiClient.get<RegistryFunctionListResponse>(
        '/creative-asset-registry/list-by-function',
        {params: {country: country || undefined}},
    );
    return res.data;
}

export async function listByDimensions(
    dimensions: string[],
    country?: string,
    sortField?: string,
    sortOrder?: 'asc' | 'desc',
    filters?: Record<string, string>,
    dateFrom?: string,
    dateTo?: string,
): Promise<DimensionListResponse> {
    const res = await apiClient.get<DimensionListResponse>(
        '/creative-asset-registry/list-by-dimensions',
        {
            params: {
                dimensions: dimensions.join(','),
                country: country || undefined,
                sortField: sortField || undefined,
                sortOrder: sortOrder || undefined,
                filters: filters ? JSON.stringify(filters) : undefined,
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
            },
        },
    );
    return res.data;
}

export async function getDimensionRecords(
    params: DimensionRecordsListParams,
): Promise<DimensionRecordsListResponse> {
    const res = await apiClient.get<DimensionRecordsListResponse>(
        '/creative-asset-registry/dimension-records',
        {
            params: {
                dimension: params.dimension,
                dimensionValue: params.dimensionValue,
                country: params.country || undefined,
                page: params.page || undefined,
                pageSize: params.pageSize || undefined,
                filters: params.filters ? JSON.stringify(params.filters) : undefined,
                dateFrom: params.dateFrom || undefined,
                dateTo: params.dateTo || undefined,
                sortBy: params.sortBy || undefined,
                sortOrder: params.sortOrder || undefined,
                sortColumns: params.sortColumns?.length ? JSON.stringify(params.sortColumns) : undefined,
            },
        },
    );
    return res.data;
}

export async function syncAtomLibrary(): Promise<{ syncedCount: number }> {
    const res = await apiClient.post<{ syncedCount: number }>(
        '/creative-asset-registry/sync-atom-library',
    );
    return res.data;
}

export async function getFilterOptions(): Promise<RegistryFilterOptions> {
    const res = await apiClient.get<RegistryFilterOptions>(
        '/creative-asset-registry/filter-options',
    );
    return res.data;
}

export async function updateProductionDate(
    id: string,
    productionDate: string,
): Promise<{ success: boolean }> {
    const res = await apiClient.patch<{ success: boolean }>(
        `/creative-asset-registry/records/${id}/production-date`,
        {productionDate},
    );
    return res.data;
}

/** 获取创意资产和消耗数据的最新更新日期 */
export async function getLastUpdated(): Promise<{
    registryUpdate: string;
    consumptionUpdate: string;
}> {
    const res = await apiClient.get<{
        registryUpdate: string;
        consumptionUpdate: string;
    }>('/creative-asset-registry/last-updated');
    return res.data;
}