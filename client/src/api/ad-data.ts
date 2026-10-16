import {apiClient} from '@/utils/axios';
import type {
    AdDataListParams,
    AdDataListResponse,
    AdDataFilterParams,
    SummaryData,
    TrendResponse,
    FilterOptions,
    ReportListResponse,
    CountryReportRow,
    MaterialTypeReportRow,
    WeeklyReportRow,
    AgentReportRow,
    DailyReportRow,
    ExportParams,
    ExportResponse,
    LastUpdatedResponse,
    BackupDataParams,
    BackupDataListResponse,
    CustomTableFieldsResponse,
    CustomTableListParams,
    CustomTableListResponse,
    CustomTableSourcesResponse,
    TablePreferencesResponse,
    SaveTablePreferencesRequest,
    TableViewListResponse,
    CreateTableViewRequest,
    UpdateTableViewRequest,
    TableView,
    CountryTimesReportResponse,
    DuiKeDailyReportResponse,
    MaterialDailyConsumptionResponse,
    MaterialWeeklyReportResponse,
    MaterialWeeklyParams,
    MaterialWeeklyDetailResponse,
    MaterialWeeklyDetailParams,
    MaterialWeeklyAllDetailResponse,
    MaterialMonthlyReportResponse,
    MaterialMonthlyParams,
    SevenBySevenParams,
    SevenBySevenReportResponse,
    TeamTierParams,
    TeamTierWeeklyResponse,
    TeamTierLadderResponse,
    TeamTierDetailResponse,
    DailyBaselineResponse,
    MemberDailyCostResponse,
    MemberDailyCostRecomputeResponse,
    MonthlyTierResponse,
    MonthlyTierParams,
    MonthlyDistributionResponse,
    MonthlyDistributionParams,
    CountryMaterialDetailResponse,
    CountryMaterialDetailRequest,
} from '@shared/api.interface';

const responseCache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

// 导出类请求需全量聚合外部大表（百万行级），耗时可达分钟级，单独放宽超时
export const EXPORT_TIMEOUT_MS = 5 * 60 * 1000;

// 带缓存 GET（无参数的只读接口用）
function cachedGet<T>(url: string): Promise<{ data: T }> {
    const now = Date.now();
    const cached = responseCache.get(url);
    if (cached && now - cached.ts < CACHE_TTL_MS) {
        return Promise.resolve({data: cached.data as T});
    }
    return apiClient.get<T>(url).then((res) => {
        responseCache.set(url, {data: res.data, ts: now});
        return res;
    });
}

// 数组/字符串参数序列化（axios 1.x 的 { serialize: fn } 形式）
const paramsSerializer = {
    serialize: (p: Record<string, unknown>) => {
        const sp = new URLSearchParams();
        Object.entries(p).forEach(([key, value]) => {
            if (value === undefined || value === null) return;
            if (Array.isArray(value)) {
                value.forEach((v) => sp.append(key, String(v)));
            } else {
                sp.append(key, String(value));
            }
        });
        return sp.toString();
    },
};

export const getSummary = (params: AdDataFilterParams) =>
    apiClient.get<SummaryData>('/ad-data/summary', {params, paramsSerializer});

export const getTrend = (params: AdDataFilterParams) =>
    apiClient.get<TrendResponse>('/ad-data/trend', {params, paramsSerializer});

export const getAdDataList = (params: AdDataListParams) =>
    apiClient.get<AdDataListResponse>('/ad-data/list', {params, paramsSerializer});

export const getCountryReport = (params: AdDataFilterParams) =>
    apiClient.get<ReportListResponse<CountryReportRow>>(
        '/ad-data/report/country',
        {params, paramsSerializer},
    );

export const getDailyBaseline = (startDate: string, endDate: string, group?: string[]) =>
    apiClient.get<DailyBaselineResponse>(
        '/ad-data/report/daily-baseline',
        {params: {startDate, endDate, group}, paramsSerializer},
    );

export const getMaterialTypeReport = (params: AdDataFilterParams) =>
    apiClient.get<ReportListResponse<MaterialTypeReportRow>>(
        '/ad-data/report/material-type',
        {params, paramsSerializer},
    );

export const getWeeklyReport = (params: AdDataFilterParams) =>
    apiClient.get<ReportListResponse<WeeklyReportRow>>(
        '/ad-data/report/weekly',
        {params, paramsSerializer},
    );

export const getAgentReport = (params: AdDataFilterParams) =>
    apiClient.get<ReportListResponse<AgentReportRow>>(
        '/ad-data/report/agent',
        {params, paramsSerializer},
    );

export const getDailyReport = (params: AdDataFilterParams) =>
    apiClient.get<ReportListResponse<DailyReportRow>>(
        '/ad-data/report/daily',
        {params, paramsSerializer},
    );

export const getAtomicReport = (params: AdDataFilterParams) =>
    apiClient.get<ReportListResponse<Record<string, string | number>>>(
        '/ad-data/report/atomic',
        {params, paramsSerializer},
    );

export const getFilterOptions = () =>
    cachedGet<FilterOptions>('/ad-data/filter-options');

export const exportData = (params: ExportParams) =>
    apiClient.get<ExportResponse>('/ad-data/export', {
        params,
        paramsSerializer,
        timeout: EXPORT_TIMEOUT_MS,
    });

export const getLastUpdated = () =>
    cachedGet<LastUpdatedResponse>('/ad-data/last-updated');

export const getBackupData = (params: BackupDataParams) =>
    apiClient.get<BackupDataListResponse>('/ad-data/backup/list', {params});

export const getCustomTableFields = () =>
    cachedGet<CustomTableFieldsResponse>('/ad-data/fields');

export const getCustomTableSources = () =>
    cachedGet<CustomTableSourcesResponse>('/ad-data/custom-sources');

export const getCustomTableData = (params: CustomTableListParams) => {
    const {drillPath, ...rest} = params;
    return apiClient.get<CustomTableListResponse>('/ad-data/custom-list', {
        params: {
            ...rest,
            drillPath: drillPath && drillPath.length > 0 ? JSON.stringify(drillPath) : undefined,
        },
        paramsSerializer,
    });
};

export const getTablePreferences = () =>
    apiClient.get<TablePreferencesResponse>('/ad-data/table-preferences');

export const saveTablePreferences = (data: SaveTablePreferencesRequest) =>
    apiClient.put<{ success: boolean }>('/ad-data/table-preferences', data);

export const getTableViews = () =>
    apiClient.get<TableViewListResponse>('/ad-data/views');

export const createTableView = (data: CreateTableViewRequest) =>
    apiClient.post<TableView>('/ad-data/views', data);

export const updateTableView = (id: string, data: UpdateTableViewRequest) =>
    apiClient.put<TableView>(`/ad-data/views/${id}`, data);

export const deleteTableView = (id: string) =>
    apiClient.delete<{ success: boolean }>(`/ad-data/views/${id}`);

export const getCountryTimesReport = (params: AdDataFilterParams) =>
    apiClient.get<CountryTimesReportResponse>(
        '/ad-data/report/country-times',
        {params, paramsSerializer},
    );

export const getDuiKeDailyReport = () =>
    apiClient.get<DuiKeDailyReportResponse>('/ad-data/report/duike-daily');

export const getMaterialDailyReport = (params: AdDataListParams, timeout?: number) =>
    apiClient.get<MaterialDailyConsumptionResponse>(
        '/ad-data/report/material-daily',
        {params, paramsSerializer, ...(timeout ? {timeout} : {})},
    );

export const getMaterialWeeklyReport = (params: MaterialWeeklyParams) =>
    apiClient.get<MaterialWeeklyReportResponse>(
        '/ad-data/report/material-weekly',
        {params, paramsSerializer},
    );

export const getMaterialWeeklyDetail = (params: MaterialWeeklyDetailParams) =>
    apiClient.get<MaterialWeeklyDetailResponse>(
        '/ad-data/report/material-weekly-detail',
        {params, paramsSerializer},
    );

export const getMaterialWeeklyAllDetail = (
    params: MaterialWeeklyParams & { page?: number; pageSize?: number },
    timeout?: number,
) =>
    apiClient.get<MaterialWeeklyAllDetailResponse>(
        '/ad-data/report/material-weekly-all-detail',
        {params, paramsSerializer, ...(timeout ? {timeout} : {})},
    );

export const getMaterialMonthlyReport = (params: MaterialMonthlyParams) =>
    apiClient.get<MaterialMonthlyReportResponse>(
        '/ad-data/report/material-monthly',
        {params, paramsSerializer},
    );

export function updateMaterialProductionDate(videoMaterialId: string, productionDate: string) {
    return apiClient.patch('/ad-data/material/production-date', {videoMaterialId, productionDate});
}

export const getSevenBySevenReport = (params: SevenBySevenParams) =>
    apiClient.get<SevenBySevenReportResponse>(
        '/ad-data/report/seven-by-seven',
        {params, paramsSerializer},
    );

export const getTeamTierReport = (params: TeamTierParams) =>
    apiClient.get<TeamTierWeeklyResponse | TeamTierLadderResponse>(
        '/ad-data/report/team-tier',
        {params, paramsSerializer},
    );

export const getTeamTierDetail = (params: Record<string, unknown>) =>
    apiClient.get<TeamTierDetailResponse>(
        '/ad-data/report/team-tier-detail',
        {params, paramsSerializer},
    );

export const getMonthlyTierReport = (params: MonthlyTierParams) =>
    apiClient.get<MonthlyTierResponse>(
        '/ad-data/report/monthly-tier',
        {params, paramsSerializer},
    );

export const getMonthlyDistributionReport = (params: MonthlyDistributionParams) =>
    apiClient.get<MonthlyDistributionResponse>(
        '/ad-data/report/monthly-distribution',
        {params, paramsSerializer},
    );

export const exportCustomTable = (
    params: { fields: string[]; source?: string; groupBy?: string[] } & Record<string, unknown>,
) =>
    apiClient.get<ExportResponse>('/ad-data/export', {
        params: {...params, reportType: 'custom-table'},
        paramsSerializer,
        timeout: EXPORT_TIMEOUT_MS,
    });

export const getMemberDailyCost = (params: {
    startDate?: string;
    endDate?: string;
    groupFilter?: string;
    countries?: string;
    memberNames?: string;
}) =>
    apiClient.get<MemberDailyCostResponse>('/member-daily-cost/list', {params});

export const recomputeMemberDailyCost = (body: { startDate?: string; endDate?: string }) =>
    apiClient.post<MemberDailyCostRecomputeResponse>('/member-daily-cost/recompute', body);

export const getLatestDataDate = () =>
    apiClient.get<{ latestDataDate: string }>('/ad-data/material/latest-date');

export const getCctLatestDataDate = () =>
    apiClient.get<{ latestDataDate: string }>('/creative-consumption-total/latest-data-date');

export const getCountryMaterialDetail = (params: CountryMaterialDetailRequest) =>
    apiClient.get<CountryMaterialDetailResponse>(
        '/ad-data/report/country-material-detail',
        {params, paramsSerializer},
    );