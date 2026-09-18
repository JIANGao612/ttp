import {apiClient} from '@client/src/utils/axios';
import type {
    CountryRegistryListParams,
    CountryRegistryListResponse,
    CountryRegistryRow,
    CountryRegistryCreateDto,
    CountryRegistryUpdateDto,
    CountryRegistryStatusChangeDto,
    CountryRegistryActiveResponse,
    CountryRegistryVisibilityResponse,
    CountryRegistryVisibilityUpdateDto,
    CountryRegistryForceResetResponse,
} from '@shared/api.interface';

// ============ 国家收录 CRUD ============

export function list(
    params: CountryRegistryListParams,
): Promise<CountryRegistryListResponse> {
    return apiClient({
        url: '/country-registry',
        method: 'GET',
        params,
    }).then((res) => res.data);
}

export function getActiveCountries(): Promise<CountryRegistryActiveResponse> {
    return apiClient({
        url: '/country-registry/active',
        method: 'GET',
    }).then((res) => res.data);
}

export function getRegions(): Promise<{ regions: string[] }> {
    return apiClient({
        url: '/country-registry/regions',
        method: 'GET',
    }).then((res) => res.data);
}

export function getVisibility(): Promise<CountryRegistryVisibilityResponse> {
    return apiClient({
        url: '/country-registry/visibility',
        method: 'GET',
    }).then((res) => res.data);
}

export function setVisibility(
    id: string,
    dto: CountryRegistryVisibilityUpdateDto,
): Promise<void> {
    return apiClient({
        url: `/country-registry/${id}/visibility`,
        method: 'PATCH',
        data: dto,
    }).then((res) => res.data);
}

export function create(
    dto: CountryRegistryCreateDto,
): Promise<CountryRegistryRow> {
    return apiClient({
        url: '/country-registry',
        method: 'POST',
        data: dto,
    }).then((res) => res.data);
}

export function update(
    id: string,
    dto: CountryRegistryUpdateDto,
): Promise<CountryRegistryRow> {
    return apiClient({
        url: `/country-registry/${id}`,
        method: 'PATCH',
        data: dto,
    }).then((res) => res.data);
}

export function remove(id: string): Promise<void> {
    return apiClient({
        url: `/country-registry/${id}`,
        method: 'DELETE',
    }).then((res) => res.data);
}

export function forceResetAll(): Promise<CountryRegistryForceResetResponse> {
    return apiClient({
        url: '/country-registry/admin/force-reset-all',
        method: 'POST',
    }).then((res) => res.data);
}

export function changeStatus(
    id: string,
    dto: CountryRegistryStatusChangeDto,
): Promise<CountryRegistryRow> {
    return apiClient({
        url: `/country-registry/${id}/status`,
        method: 'PATCH',
        data: dto,
    }).then((res) => res.data);
}

// ============ 所有国家列表 ============

export interface AllCountriesItem {
    code: string;
    name: string;
    region: string;
    status: string;
}

export function getAllCountries(): Promise<{ countries: AllCountriesItem[] }> {
    return apiClient({
        url: '/country-registry/all',
        method: 'GET',
    }).then((res) => res.data);
}

// ============ 报表国家列表（按大区分组、带颜色） ============

export interface ReportCountryItem {
    code: string;
    name: string;
    region: string;
    regionColor: string;
    sortOrder: number;
    status: string;
    showInReports: boolean;
}

export function getReportCountries(): Promise<{ countries: ReportCountryItem[] }> {
    return apiClient({
        url: '/country-registry/report-countries',
        method: 'GET',
    }).then((res) => res.data);
}