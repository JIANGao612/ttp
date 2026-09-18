import {
    Controller, Get, Post, Delete, Param, Query, Req, Body,
    Logger, BadRequestException,
} from '@nestjs/common';
import type {
    AdDataFilterParams, AdDataListParams, AdDataListResponse, SummaryData,
    TrendResponse, FilterOptions, ReportListResponse, CountryReportRow,
    MaterialTypeReportRow, WeeklyReportRow, AgentReportRow, DailyReportRow,
    CountryTimesReportResponse, ReportType, ExportParams, ExportResponse,
    LastUpdatedResponse,
} from '@shared/api.interface';
import type {Request} from 'express';
import {AdDataService} from './ad-data.service';

type QueryValue = string | string[] | undefined;

@Controller('api/ad-data')
export class AdDataController {
    private readonly logger = new Logger(AdDataController.name);

    constructor(private readonly adDataService: AdDataService) {
    }

    // ============== Query-param 解析 ==============
    private parseArray(value: unknown): string[] | undefined {
        if (value === undefined || value === '') return undefined;
        if (Array.isArray(value)) {
            const arr = value.map((v: unknown) => String(v)).filter(Boolean);
            return arr.length > 0 ? arr : undefined;
        }
        if (typeof value === 'string') {
            const parts = value.split(',').map((s: string) => s.trim()).filter(Boolean);
            return parts.length > 0 ? parts : undefined;
        }
        if (typeof value === 'object' && value !== null) {
            const vals = Object.values(value).map((v: unknown) => String(v)).filter(Boolean);
            return vals.length > 0 ? vals : undefined;
        }
        return undefined;
    }

    private parseString(value: unknown): string | undefined {
        if (value === undefined || value === '') return undefined;
        if (typeof value === 'string') return value || undefined;
        if (Array.isArray(value)) return value[0] != null ? String(value[0]) : undefined;
        if (typeof value === 'object' && value !== null) {
            const first = Object.values(value)[0];
            return first != null ? String(first) : undefined;
        }
        return String(value) || undefined;
    }

    private parseFilterParams(query: Record<string, QueryValue>): AdDataFilterParams {
        const dm = this.parseString(query.dateMode);
        return {
            dateStart: this.parseString(query.dateStart),
            dateMode: dm === 'before' ? 'before' : dm === 'after' ? 'after' : dm === 'range' ? 'range' : undefined,
            materialType: this.parseArray(query.materialType),
            agent: this.parseArray(query.agent),
            country: this.parseArray(query.country),
            materialCategory: this.parseArray(query.materialCategory),
            audienceType: this.parseArray(query.audienceType),
            newOrActive: this.parseArray(query.newOrActive),
            materialDirection: this.parseArray(query.materialDirection),
            placement: this.parseArray(query.placement),
            seriesNames: this.parseArray(query.seriesNames),
            adGroupNames: this.parseArray(query.adGroupNames),
            creativeNames: this.parseArray(query.creativeNames),
            keyword: this.parseString(query.keyword),
            investTimeStart: this.parseString(query.investTimeStart),
            investTimeEnd: this.parseString(query.investTimeEnd),
            trustedData: query.trustedData === 'true',
            zeroCostOnly: query.zeroCostOnly === 'true',
            weekStartDay: query.weekStartDay !== undefined ? parseInt(String(query.weekStartDay), 10) : undefined,
            weekAnchorDate: this.parseString(query.weekAnchorDate),
            weekCount: query.weekCount !== undefined ? Number(query.weekCount) : undefined,
            creativeId: this.parseArray(query.creativeId),
            videoMaterialId: this.parseArray(query.videoMaterialId),
            creativeIdentityId: this.parseArray(query.creativeIdentityId),
            advertiser: this.parseArray(query.advertiser),
        };
    }

    // ============== 查询端点 ==============
    @Get('summary')
    async getSummary(@Query() query: Record<string, QueryValue>): Promise<SummaryData> {
        return this.adDataService.getSummary(this.parseFilterParams(query));
    }

    @Get('trend')
    async getTrend(@Query() query: Record<string, QueryValue>): Promise<TrendResponse> {
        return this.adDataService.getTrend(this.parseFilterParams(query));
    }

    @Get('list')
    async getList(@Query() query: Record<string, QueryValue>): Promise<AdDataListResponse> {
        const params: AdDataListParams = {
            ...this.parseFilterParams(query),
            page: parseInt(this.parseString(query.page) ?? '1', 10),
            pageSize: parseInt(this.parseString(query.pageSize) ?? '20', 10),
        };
        return this.adDataService.getAdDataList(params);
    }

    @Get('report/country')
    async getCountryReport(@Query() query: Record<string, QueryValue>): Promise<ReportListResponse<CountryReportRow>> {
        return this.adDataService.getCountryReport(this.parseFilterParams(query));
    }

    @Get('report/country-times')
    async getCountryTimesReport(@Query() query: Record<string, QueryValue>): Promise<CountryTimesReportResponse> {
        return this.adDataService.getCountryTimesReport(this.parseFilterParams(query));
    }

    @Get('report/material-type')
    async getMaterialTypeReport(@Query() query: Record<string, QueryValue>): Promise<ReportListResponse<MaterialTypeReportRow>> {
        return this.adDataService.getMaterialTypeReport(this.parseFilterParams(query));
    }

    @Get('report/weekly')
    async getWeeklyReport(@Query() query: Record<string, QueryValue>): Promise<ReportListResponse<WeeklyReportRow>> {
        return this.adDataService.getWeeklyReport(this.parseFilterParams(query));
    }

    @Get('report/agent')
    async getAgentReport(@Query() query: Record<string, QueryValue>): Promise<ReportListResponse<AgentReportRow>> {
        return this.adDataService.getAgentReport(this.parseFilterParams(query));
    }

    @Get('report/daily')
    async getDailyReport(@Query() query: Record<string, QueryValue>): Promise<ReportListResponse<DailyReportRow>> {
        return this.adDataService.getDailyReport(this.parseFilterParams(query));
    }

    @Get('filter-options')
    async getFilterOptions(): Promise<FilterOptions> {
        return this.adDataService.getFilterOptions();
    }

    @Get('last-updated')
    async getLastUpdated(): Promise<LastUpdatedResponse> {
        return this.adDataService.getLastUpdated();
    }

    // ============== 导出 ==============
    @Get('export')
    async exportData(@Query() query: Record<string, QueryValue>): Promise<ExportResponse> {
        const reportType = (this.parseString(query.reportType) ?? 'source') as ReportType;
        const params: ExportParams = {
            ...this.parseFilterParams(query),
            consumptionDateStart: this.parseString(query.consumptionDateStart),
            consumptionDateEnd: this.parseString(query.consumptionDateEnd),
            reportType,
        } as ExportParams;

        if (reportType === 'source') {
            const dateStart = params.consumptionDateStart || params.investTimeStart;
            const dateEnd = params.consumptionDateEnd || params.investTimeEnd;
            if (!dateStart || !dateEnd) {
                throw new BadRequestException('导出原始数据需要指定消费日期范围');
            }
        }
        return this.adDataService.exportData(params);
    }
}