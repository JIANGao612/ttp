import {Injectable, Logger, BadRequestException, OnModuleInit} from '@nestjs/common';
import type {PostgresJsDatabase} from 'drizzle-orm/postgres-js';
import {ExternalDbService} from '../external-db/external-db.service';
import {dataSource, dataSourceDetail} from '@server/database/app-schema';
import {calcMaterialNameClean} from '../data-upload/derived-fields';
import {eq, and, sql, gte, lte, desc, count, ne, or} from 'drizzle-orm';
import type {SQL} from 'drizzle-orm';
import type {
    AdDataFilterParams, SummaryData, TrendResponse, TrendItem, FilterOptions,
    AdDataListParams, AdDataListResponse, AdRecordFull,
    ReportListResponse, CountryReportRow, MaterialTypeReportRow,
    WeeklyReportRow, AgentReportRow, DailyReportRow, ReportBaseFields,
    LastUpdatedResponse, CountryTimesReportResponse, CountryTimesReportRow,
    ReportType, ExportParams, ExportResponse,
} from '@shared/api.interface';

const COUNTRY_CODE_NORMALIZE_MAP: Record<string, string> = {GB: 'UK', AE: 'UAE'};

function calcMetrics(cost: number, impressions: number, clicks: number, conversions: number): ReportBaseFields {
    return {
        totalCost: cost,
        totalImpressions: impressions,
        totalClicks: clicks,
        totalConversions: conversions,
        cpa: conversions > 0 ? Number((cost / conversions).toFixed(2)) : null,
        cpm: impressions > 0 ? Number((cost / impressions * 1000).toFixed(2)) : null,
        ctr: impressions > 0 ? Number((clicks / impressions).toFixed(4)) : null,
    };
}

interface AggRow {
    totalCost: string;
    totalImpressions: string;
    totalClicks: string;
    totalConversions: string;
}

function toMetricFields(row: AggRow): ReportBaseFields {
    return calcMetrics(
        Number(row.totalCost) || 0,
        Number(row.totalImpressions) || 0,
        Number(row.totalClicks) || 0,
        Number(row.totalConversions) || 0,
    );
}

function aggSelect() {
    return {
        totalCost: sql<string>`CAST(COALESCE(SUM(
        ${dataSource.cost}
        ),
        0
        )
        AS
        TEXT
        )`,
        totalImpressions: sql<string>`CAST(COALESCE(SUM(
        ${dataSource.impressions}
        ),
        0
        )
        AS
        TEXT
        )`,
        totalClicks: sql<string>`CAST(COALESCE(SUM(
        ${dataSource.clicks}
        ),
        0
        )
        AS
        TEXT
        )`,
        totalConversions: sql<string>`CAST(COALESCE(SUM(
        ${dataSource.conversions}
        ),
        0
        )
        AS
        TEXT
        )`,
    };
}

@Injectable()
export class AdDataService implements OnModuleInit {
    private readonly logger = new Logger(AdDataService.name);
    private _db: PostgresJsDatabase | null = null;
    private tableReady = false;
    private _initPromise: Promise<PostgresJsDatabase> | null = null;
    private filterOptionsCache: { data: FilterOptions; expiresAt: number } | null = null;
    private static readonly FILTER_OPTIONS_CACHE_TTL = 5 * 60 * 1000;

    private _lastUpdatedCache: { data: LastUpdatedResponse; ts: number } | null = null;
    private static readonly LAST_UPDATED_CACHE_TTL = 60 * 1000;

    constructor(private readonly externalDb: ExternalDbService) {
    }

    private async ensureDb(): Promise<PostgresJsDatabase> {
        if (this._initPromise) return this._initPromise;
        this._initPromise = this._doEnsureDb().catch((err) => {
            this._initPromise = null;
            throw err;
        });
        return this._initPromise;
    }

    private async _doEnsureDb(): Promise<PostgresJsDatabase> {
        if (!this._db) {
            this._db = await this.externalDb.getDb();
        }
        const db = this._db!;
        if (!this.tableReady) {
            this.tableReady = true;
            await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_data_source_agent_date_cost ON data_source(agent, date_value, cost)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_data_source_agent_datedesc_costdesc ON data_source(agent, date_value DESC, cost DESC)`);
        }
        return db;
    }

    private buildFilterConditions(params: AdDataFilterParams): SQL | undefined {
        const conditions: SQL[] = [];
        conditions.push(ne(dataSource.seriesName, '(unmapped)'));
        conditions.push(sql`(${dataSource.impressions} > 0 OR ${dataSource.dataSource} = 'zero_cost')`);
        conditions.push(sql`${dataSource.creativeId}
        IS NOT NULL AND
        ${dataSource.creativeId}
        !=
        ''`);
        conditions.push(sql`(${dataSource.seriesName} IS NULL OR (${dataSource.seriesName} NOT LIKE '%总计%' AND ${dataSource.seriesName} NOT LIKE '%合计%' AND ${dataSource.seriesName} NOT LIKE '%汇总%' AND ${dataSource.seriesName} NOT LIKE 'Total%'))`);

        if (params.investTimeStart) conditions.push(gte(dataSource.dateValue, params.investTimeStart));
        if (params.investTimeEnd) conditions.push(lte(dataSource.dateValue, params.investTimeEnd));
        if (params.materialType?.length) conditions.push(or(...params.materialType.map(v => eq(dataSource.materialType, v)))!);
        if (params.agent?.length) conditions.push(or(...params.agent.map(v => eq(dataSource.agent, v)))!);
        if (params.country?.length) conditions.push(or(...params.country.map(v => eq(dataSource.country, v)))!);
        if (params.materialCategory?.length) conditions.push(or(...params.materialCategory.map(v => eq(dataSource.materialCategory, v)))!);
        if (params.materialDirection?.length) conditions.push(or(...params.materialDirection.map(v => eq(dataSource.materialDirection, v)))!);
        if (params.newOrActive?.length) conditions.push(or(...params.newOrActive.map(v => eq(dataSource.newOrActive, v)))!);
        if (params.keyword) {
            const kw = `%${params.keyword}%`;
            const keywordConcat = sql`COALESCE(
            ${dataSource.seriesName},
            ''
            )
            ||
            ' '
            ||
            COALESCE
            (
            ${dataSource.adGroupName},
            ''
            )
            ||
            ' '
            ||
            COALESCE
            (
            ${dataSource.creativeName},
            ''
            )
            ||
            ' '
            ||
            COALESCE
            (
            ${dataSource.cleanedMaterialName},
            ''
            )
            ||
            ' '
            ||
            COALESCE
            (
            ${dataSource.creativeId},
            ''
            )
            ||
            ' '
            ||
            COALESCE
            (
            ${dataSource.videoMaterialId},
            ''
            )
            ||
            ' '
            ||
            COALESCE
            (
            ${dataSource.country},
            ''
            )
            ||
            ' '
            ||
            COALESCE
            (
            ${dataSource.agent},
            ''
            )`;
            conditions.push(sql`${keywordConcat}
            ILIKE
            ${kw}`);
        }
        return conditions.length > 0 ? and(...conditions) : undefined;
    }

    // 1. Summary
    async getSummary(params: AdDataFilterParams): Promise<SummaryData> {
        const db = await this.ensureDb();
        const whereClause = this.buildFilterConditions(params) ?? sql`TRUE`;
        const rows = await db.select({
            totalCost: sql<string>`CAST(COALESCE(SUM(
            ${dataSource.cost}
            ),
            0
            )
            AS
            TEXT
            )`,
            totalConversions: sql<string>`CAST(COALESCE(SUM(
            ${dataSource.conversions}
            ),
            0
            )
            AS
            TEXT
            )`,
        }).from(dataSource).where(whereClause);
        const totalCost = Number(rows[0]?.totalCost) || 0;
        const totalConversions = Number(rows[0]?.totalConversions) || 0;
        return {
            totalCost,
            totalConversions,
            avgCost: totalConversions > 0 ? Number((totalCost / totalConversions).toFixed(2)) : null,
        };
    }

    // 2. Trend
    async getTrend(params: AdDataFilterParams): Promise<TrendResponse> {
        const db = await this.ensureDb();
        const {investTimeStart, investTimeEnd, agent: _agent, ...dimensionFilters} = params;
        const baseWhere = this.buildFilterConditions(dimensionFilters);
        const dateConditions: SQL[] = [];
        if (investTimeStart) dateConditions.push(gte(dataSource.dateValue, investTimeStart));
        if (investTimeEnd) dateConditions.push(lte(dataSource.dateValue, investTimeEnd));
        const whereClause = baseWhere
            ? (dateConditions.length > 0 ? and(baseWhere, ...dateConditions) : baseWhere)
            : (dateConditions.length > 0 ? and(...dateConditions) : undefined);

        const scopeExpr = sql`CASE WHEN
        ${dataSource.agent}
        =
        'XB'
        THEN
        'self'
        ELSE
        'market'
        END`;
        const rows = await db.select({
            date: dataSource.dateValue,
            scope: sql<string>`${scopeExpr}`,
            cost: sql<string>`CAST(COALESCE(SUM(
            ${dataSource.cost}
            ),
            0
            )
            AS
            TEXT
            )`,
            conversions: sql<string>`CAST(COALESCE(SUM(
            ${dataSource.conversions}
            ),
            0
            )
            AS
            TEXT
            )`,
        }).from(dataSource).where(whereClause).groupBy(dataSource.dateValue, scopeExpr).orderBy(dataSource.dateValue);

        const selfItems: TrendItem[] = [];
        const marketItems: TrendItem[] = [];
        const combinedMap = new Map<string, { cost: number; conversions: number }>();
        for (const row of rows) {
            const cost = Number(row.cost) || 0;
            const conversions = Number(row.conversions) || 0;
            const item: TrendItem = {
                date: row.date ?? '',
                cost,
                cpa: conversions > 0 ? Number((cost / conversions).toFixed(2)) : null,
            };
            if (row.scope === 'self') selfItems.push(item); else marketItems.push(item);
            const existing = combinedMap.get(item.date) ?? {cost: 0, conversions: 0};
            combinedMap.set(item.date, {cost: existing.cost + cost, conversions: existing.conversions + conversions});
        }
        const items: TrendItem[] = [...combinedMap.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, {cost, conversions}]) => ({
                date,
                cost,
                cpa: conversions > 0 ? Number((cost / conversions).toFixed(2)) : null,
            }));
        return {items, selfItems, marketItems};
    }

    // 3. Filter Options
    async getFilterOptions(): Promise<FilterOptions> {
        const cached = this.filterOptionsCache;
        if (cached && Date.now() < cached.expiresAt) return cached.data;
        return this.loadFilterOptions();
    }

    onModuleInit(): void {
        void this.getFilterOptions().catch(() => undefined);
    }

    private async loadFilterOptions(): Promise<FilterOptions> {
        const db = await this.ensureDb();
        const recentDate = new Date();
        recentDate.setDate(recentDate.getDate() - 180);
        const recentDateStr = recentDate.toISOString().split('T')[0];

        const [countriesRows, materialTypesRows, agentsRows, newOrActiveRows] = await Promise.all([
            db.execute(sql`SELECT DISTINCT country AS val
                           FROM data_source
                           WHERE country IS NOT NULL
                             AND country != ''`) as unknown as Promise<Array<{ val: string }>>,
            db.execute(sql`SELECT DISTINCT material_type AS val
                           FROM data_source
                           WHERE material_type IS NOT NULL
                             AND material_type != ''`) as unknown as Promise<Array<{ val: string }>>,
            db.execute(sql`SELECT DISTINCT agent AS val
                           FROM data_source
                           WHERE agent IS NOT NULL
                             AND agent != ''`) as unknown as Promise<Array<{ val: string }>>,
            db.execute(sql`SELECT DISTINCT new_or_active AS val
                           FROM data_source
                           WHERE new_or_active IS NOT NULL
                             AND new_or_active != ''`) as unknown as Promise<Array<{ val: string }>>,
        ]);

        const extractVals = (rows: Array<{ val: string }>) => rows.map(r => r.val).filter(v => v !== '');
        const sortOptions = (opts: string[]) => [...opts].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));

        const result: FilterOptions = {
            countries: sortOptions(extractVals(countriesRows)),
            materialTypes: sortOptions(extractVals(materialTypesRows)),
            agents: sortOptions(extractVals(agentsRows)),
            materialCategories: [],
            audienceTypes: [],
            newOrActive: sortOptions(extractVals(newOrActiveRows)),
            placements: [],
            seriesNames: [],
            adGroupNames: [],
            creativeNames: [],
            advertisers: [],
            materialDirections: ['TTS', 'Nonshop', 'General'],
        };
        this.filterOptionsCache = {data: result, expiresAt: Date.now() + AdDataService.FILTER_OPTIONS_CACHE_TTL};
        return result;
    }

    // 4. Ad data list
    async getAdDataList(params: AdDataListParams): Promise<AdDataListResponse> {
        const db = await this.ensureDb();
        const page = Math.max(1, params.page ?? 1);
        const pageSize = Math.max(1, Math.min(200, params.pageSize ?? 20));
        const offset = (page - 1) * pageSize;
        const whereClause = this.buildFilterConditions(params) ?? sql`TRUE`;

        const countResult = await db.select({count: count()}).from(dataSource).where(whereClause);
        const total = Number(countResult[0]?.count ?? 0);

        const rows = await db.select({
            id: dataSource.id,
            seriesName: dataSource.seriesName,
            recordDate: dataSource.recordDate,
            adGroupName: dataSource.adGroupName,
            creativeName: dataSource.creativeName,
            cost: dataSource.cost,
            impressions: dataSource.impressions,
            clicks: dataSource.clicks,
            conversions: dataSource.conversions,
            country: dataSource.country,
            materialType: dataSource.materialType,
            placement: dataSource.placement,
            agent: dataSource.agent,
            dateValue: dataSource.dateValue,
            materialCategory: dataSource.materialCategory,
            newOrActive: dataSource.newOrActive,
            newUserActivated: dataSource.newUserActivated,
            placer: dataSource.placer,
            bidType: dataSource.bidType,
            materialDirection: dataSource.materialDirection,
            bcDirection: dataSource.bcDirection,
            materialDate: dataSource.materialDate,
            secondaryCategory: dataSource.secondaryCategory,
            tertiaryCategory: dataSource.tertiaryCategory,
            creativeIdentityId: dataSource.creativeIdentityId,
            campaignId: dataSource.campaignId,
            cleanedMaterialName: dataSource.cleanedMaterialName,
            adGroupId: dataSource.adGroupId,
            adName: dataSource.adName,
            adId: dataSource.adId,
            creativeId: dataSource.creativeId,
            videoMaterialId: dataSource.videoMaterialId,
            createdAt: dataSource.createdAt,
            updatedAt: dataSource.updatedAt,
            cpaOriginal: dataSourceDetail.cpaOriginal,
            play2s: dataSourceDetail.play2s,
            playComplete: dataSourceDetail.playComplete,
            avgVideoPlayDuration: dataSourceDetail.avgVideoPlayDuration,
            playCount: dataSourceDetail.playCount,
        }).from(dataSource).leftJoin(dataSourceDetail, eq(dataSourceDetail.dataSourceId, dataSource.id))
            .where(whereClause).orderBy(desc(dataSource.dateValue), desc(dataSource.cost)).limit(pageSize).offset(offset);

        const items = rows.map((row) => ({
            id: row.id, seriesName: row.seriesName, recordDate: row.recordDate,
            adGroupName: row.adGroupName ?? '', creativeName: row.creativeName ?? '',
            cost: Number(row.cost) || 0, impressions: row.impressions, clicks: row.clicks, conversions: row.conversions,
            country: row.country ?? '', materialType: row.materialType ?? '', placement: row.placement ?? '',
            agent: row.agent ?? '', dateValue: row.dateValue ?? '', materialCategory: row.materialCategory ?? '',
            newOrActive: row.newOrActive ?? '', newUserActivated: row.newUserActivated ?? 0,
            placer: row.placer ?? '', bidType: row.bidType ?? '', materialDirection: row.materialDirection ?? '',
            bcDirection: row.bcDirection ?? '', materialDate: row.materialDate ?? '',
            secondaryCategory: row.secondaryCategory ?? '', tertiaryCategory: row.tertiaryCategory ?? '',
            creativeIdentityId: row.creativeIdentityId ?? '', campaignId: row.campaignId ?? '',
            cleanedMaterialName: calcMaterialNameClean(String(row.creativeName ?? '')),
            adGroupId: row.adGroupId ?? '', adName: row.adName ?? '', adId: row.adId ?? '',
            creativeId: row.creativeId ?? '', videoMaterialId: row.videoMaterialId ?? '',
            createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
            updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
            cpaOriginal: row.cpaOriginal != null && Number(row.cpaOriginal) > 0 ? Number(Number(row.cpaOriginal).toFixed(2))
                : Number(row.conversions) > 0 ? Number((Number(row.cost) / Number(row.conversions)).toFixed(2)) : null,
            cpmOriginal: 0, playCount: row.playCount ?? 0, play2s: row.play2s ?? 0, play5s: 0,
            playComplete: row.playComplete ?? 0,
            materialNameClean: calcMaterialNameClean(String(row.creativeName ?? '')),
            audienceType: '', bcType: '', videoCompleteRate: 0,
            avgVideoPlayDuration: row.avgVideoPlayDuration ? Number(row.avgVideoPlayDuration) : 0,
            maxSettlementDate: '', nonSettlementCost: 0,
        })) as AdRecordFull[];

        return {items, total, summary: null};
    }

    // 5. Country report
    async getCountryReport(params: AdDataFilterParams): Promise<ReportListResponse<CountryReportRow>> {
        const db = await this.ensureDb();
        const whereClause = this.buildFilterConditions(params) ?? sql`TRUE`;
        const rows = await db.select({country: dataSource.country, date: dataSource.dateValue, ...aggSelect()})
            .from(dataSource).where(whereClause).groupBy(dataSource.country, dataSource.dateValue)
            .orderBy(desc(dataSource.dateValue), dataSource.country);
        const items: CountryReportRow[] = rows.map(row => ({
            country: row.country ?? '',
            date: row.date ?? '',
            ...toMetricFields(row),
        }));
        return {items, total: items.length};
    }

    // 6. Country Times report
    async getCountryTimesReport(params: AdDataFilterParams): Promise<CountryTimesReportResponse> {
        const db = await this.ensureDb();
        const whereConditions: SQL[] = [];
        if (params.investTimeStart) whereConditions.push(sql`record_date
        >=
        ${params.investTimeStart}`);
        if (params.investTimeEnd) whereConditions.push(sql`record_date
        <=
        ${params.investTimeEnd}`);
        const whereClause = whereConditions.length > 0
            ? sql`WHERE
                ${sql.join(whereConditions, sql` AND `)}`
            : sql``;

        const records = await db.execute(sql`SELECT record_date, time_slot, total_cost, country_costs
                                             FROM hourly_data_record ${whereClause}
                                             ORDER BY record_date ASC, time_slot ASC`) as unknown as Array<{
            record_date: string;
            time_slot: string;
            total_cost: string;
            country_costs: string;
        }>;
        const items: CountryTimesReportRow[] = [];
        for (const rec of records) {
            let countryCosts: Record<string, number> = {};
            try {
                countryCosts = rec.country_costs ? JSON.parse(rec.country_costs) : {};
            } catch {
                countryCosts = {};
            }
            for (const [country, cost] of Object.entries(countryCosts)) {
                items.push({
                    date: rec.record_date,
                    timeSlot: rec.time_slot as '12:00' | '16:00' | '22:00',
                    country: COUNTRY_CODE_NORMALIZE_MAP[country] ?? country,
                    totalCost: Number(cost) || 0,
                    ccRatio: 0,
                    lcRatio: 0,
                });
            }
        }
        return {items, total: items.length};
    }

    // 7. Material Type report
    async getMaterialTypeReport(params: AdDataFilterParams): Promise<ReportListResponse<MaterialTypeReportRow>> {
        const db = await this.ensureDb();
        const whereClause = this.buildFilterConditions(params) ?? sql`TRUE`;
        const rows = await db.select({
            date: dataSource.dateValue,
            ugcStory: sql<string>`CAST(COALESCE(SUM(CASE WHEN
            ${dataSource.materialType}
            IN
            (
            'UGC',
            '全球演员',
            'Story'
            )
            THEN
            ${dataSource.cost}
            ELSE
            0
            END
            ),
            0
            )
            AS
            TEXT
            )`,
            aigc: sql<string>`CAST(COALESCE(SUM(CASE WHEN
            ${dataSource.materialType}
            =
            'AIGC'
            THEN
            ${dataSource.cost}
            ELSE
            0
            END
            ),
            0
            )
            AS
            TEXT
            )`,
            ae: sql<string>`CAST(COALESCE(SUM(CASE WHEN
            ${dataSource.materialType}
            =
            'AE'
            THEN
            ${dataSource.cost}
            ELSE
            0
            END
            ),
            0
            )
            AS
            TEXT
            )`,
            studio: sql<string>`CAST(COALESCE(SUM(CASE WHEN LOWER(
            ${dataSource.materialType}
            )
            =
            'studio'
            THEN
            ${dataSource.cost}
            ELSE
            0
            END
            ),
            0
            )
            AS
            TEXT
            )`,
            other: sql<string>`CAST(COALESCE(SUM(CASE WHEN
            ${dataSource.materialType}
            IN
            (
            '其他',
            'Repurposed'
            )
            OR
            LOWER
            (
            ${dataSource.materialType}
            )
            =
            'repurposed'
            THEN
            ${dataSource.cost}
            ELSE
            0
            END
            ),
            0
            )
            AS
            TEXT
            )`,
        }).from(dataSource).where(whereClause).groupBy(dataSource.dateValue).orderBy(desc(dataSource.dateValue));

        const items: MaterialTypeReportRow[] = rows.map(row => {
            const ugcStory = Number(row.ugcStory) || 0, aigc = Number(row.aigc) || 0, ae = Number(row.ae) || 0;
            const studio = Number(row.studio) || 0, other = Number(row.other) || 0;
            const totalCost = ugcStory + aigc + ae + studio + other;
            return {
                date: row.date ?? '', totalCost, ugcStory, aigc, ae, studio, other,
                actualShoot: ugcStory + studio, editing: aigc + ae + other,
                revenueEstimate1: Number(((ugcStory + ae + studio) * 0.06 * 7).toFixed(2)),
                revenueEstimate2: Number((aigc * 0.04 * 7).toFixed(2)),
                ugcRatio: totalCost > 0 ? Number((ugcStory / totalCost).toFixed(4)) : 0,
                aiRatio: totalCost > 0 ? Number((aigc / totalCost).toFixed(4)) : 0,
                aeRatio: totalCost > 0 ? Number((ae / totalCost).toFixed(4)) : 0,
            };
        });
        return {items, total: items.length};
    }

    // 8. Weekly report
// 8. Weekly report —— JS 侧计算周起始日，SQL 中无 :: 语法
    async getWeeklyReport(params: AdDataFilterParams): Promise<ReportListResponse<WeeklyReportRow>> {
        const db = await this.ensureDb();
        const whereClause = this.buildFilterConditions(params) ?? sql`TRUE`;
        const weekWhere = and(whereClause, sql`${dataSource.dateValue}
        ~ '^[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}$'`);

        // 按天聚合
        const rows = await db.select({
            dateValue: dataSource.dateValue,
            ...aggSelect(),
        }).from(dataSource).where(weekWhere).groupBy(dataSource.dateValue);

        // JS 侧按 weekStartDay 归并到周
        const weekStartDay = params.weekStartDay ?? 1;
        const weekMap = new Map<string, {
            weekStart: string;
            totalCost: number;
            totalImpressions: number;
            totalClicks: number;
            totalConversions: number;
        }>();

        for (const row of rows) {
            const ds = String(row.dateValue ?? '');
            if (!ds) continue;
            const d = new Date(ds + 'T00:00:00');
            if (isNaN(d.getTime())) continue;

            const dow = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
            const offset = (dow - weekStartDay + 7) % 7;
            const startDate = new Date(d);
            startDate.setDate(startDate.getDate() - offset);
            const startStr = startDate.toISOString().slice(0, 10);

            const cost = Number(row.totalCost) || 0;
            const imp = Number(row.totalImpressions) || 0;
            const clicks = Number(row.totalClicks) || 0;
            const conv = Number(row.totalConversions) || 0;

            const existing = weekMap.get(startStr);
            if (existing) {
                existing.totalCost += cost;
                existing.totalImpressions += imp;
                existing.totalClicks += clicks;
                existing.totalConversions += conv;
            } else {
                weekMap.set(startStr, {
                    weekStart: startStr,
                    totalCost: cost,
                    totalImpressions: imp,
                    totalClicks: clicks,
                    totalConversions: conv,
                });
            }
        }

        const items: WeeklyReportRow[] = [...weekMap.values()]
            .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
            .map(w => {
                const metrics = calcMetrics(w.totalCost, w.totalImpressions, w.totalClicks, w.totalConversions);
                const endDate = new Date(w.weekStart + 'T00:00:00');
                endDate.setDate(endDate.getDate() + 6);
                return {
                    weekStart: w.weekStart,
                    weekEnd: endDate.toISOString().slice(0, 10),
                    ...metrics,
                };
            });

        return {items, total: items.length};
    }

    // 9. Agent report
    async getAgentReport(params: AdDataFilterParams): Promise<ReportListResponse<AgentReportRow>> {
        const db = await this.ensureDb();
        const whereClause = this.buildFilterConditions(params) ?? sql`TRUE`;
        const rows = await db.select({agent: dataSource.agent, date: dataSource.dateValue, ...aggSelect()})
            .from(dataSource).where(whereClause).groupBy(dataSource.agent, dataSource.dateValue)
            .orderBy(desc(dataSource.dateValue), dataSource.agent);
        const items: AgentReportRow[] = rows.map(row => ({
            agent: row.agent ?? '',
            date: row.date ?? '',
            ...toMetricFields(row),
        }));
        return {items, total: items.length};
    }

    // 10. Daily report
    async getDailyReport(params: AdDataFilterParams): Promise<ReportListResponse<DailyReportRow>> {
        const db = await this.ensureDb();
        const whereClause = this.buildFilterConditions(params) ?? sql`TRUE`;
        const rows = await db.select({
            date: dataSource.dateValue,
            country: dataSource.country,
            materialNewOrActive: dataSource.newOrActive,
            audienceCategory: dataSource.secondaryCategory,
            directionCategory: dataSource.tertiaryCategory,
            totalCost: sql<string>`CAST(COALESCE(SUM(
            ${dataSource.cost}
            ),
            0
            )
            AS
            TEXT
            )`,
            totalConversions: sql<string>`CAST(COALESCE(SUM(
            ${dataSource.conversions}
            ),
            0
            )
            AS
            TEXT
            )`,
            newUserActivated: sql<string>`CAST(COALESCE(SUM(
            ${dataSource.newUserActivated}
            ),
            0
            )
            AS
            TEXT
            )`,
        }).from(dataSource).where(whereClause).groupBy(
            dataSource.dateValue, dataSource.country, dataSource.newOrActive,
            dataSource.secondaryCategory, dataSource.tertiaryCategory,
        ).orderBy(desc(dataSource.dateValue), dataSource.country);

        const items: DailyReportRow[] = rows.map(row => ({
            date: row.date ?? '',
            country: row.country ?? '',
            materialNewOrActive: row.materialNewOrActive ?? '',
            audienceCategory: row.audienceCategory ?? '',
            directionCategory: row.directionCategory ?? '',
            totalCost: Number(row.totalCost) || 0,
            totalConversions: Number(row.totalConversions) || 0,
            newUserActivated: Number(row.newUserActivated) || 0,
        }));
        return {items, total: items.length};
    }

    // 11. Last Updated
    async getLastUpdated(): Promise<LastUpdatedResponse> {
        const now = Date.now();
        if (this._lastUpdatedCache && now - this._lastUpdatedCache.ts < AdDataService.LAST_UPDATED_CACHE_TTL) {
            return this._lastUpdatedCache.data;
        }
        const db = await this.ensureDb();
        const rows = await db.select({
            lastUpdated: sql<string>`CAST(MAX(
            ${dataSource.updatedAt}
            )
            AS
            TEXT
            )`,
        }).from(dataSource);
        const raw = rows[0]?.lastUpdated;
        const result = {lastUpdated: raw ? new Date(raw).toISOString() : new Date().toISOString()};
        this._lastUpdatedCache = {data: result, ts: now};
        return result;
    }

    // 12. Export placeholder
    async exportData(_params: ExportParams): Promise<ExportResponse> {
        throw new BadRequestException('导出功能待实现');
    }
}