// 保持与 ad-data.ts 一致的风格：返回 AxiosResponse，由调用方 .data 取业务数据
import {apiClient} from '@/utils/axios';
import type {
    AddMarketConsumptionDayRequest,
    AddMarketConsumptionDayResponse,
    MarketConsumptionListResponse,
    MarketConsumptionRow,
    MarketConsumptionSummaryResponse,
    UpdateMarketConsumptionRequest,
} from '@shared/api.interface';

export const list = () =>
    apiClient.get<MarketConsumptionListResponse>('/market-consumption');

export const getSummary = () =>
    apiClient.get<MarketConsumptionSummaryResponse>(
        '/market-consumption/summary',
    );

export const update = (id: string, body: UpdateMarketConsumptionRequest) =>
    apiClient.patch<MarketConsumptionRow>(
        `/market-consumption/${id}`,
        body,
    );

export const addDay = (body: AddMarketConsumptionDayRequest) =>
    apiClient.post<AddMarketConsumptionDayResponse>(
        '/market-consumption/days',
        body,
    );