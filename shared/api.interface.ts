/* 前后端共享的类型定义 - 投放数据自动化存储与分析平台 */

// ============ 基础实体类型 ============

/** 投放数据主表记录 */
export interface AdRecord {
    id: string;
    seriesName: string;
    recordDate: string;
    adGroupName: string;
    creativeName: string;
    cost: number;
    impressions: number;
    clicks: number;
    conversions: number;
    country: string;
    materialType: string;
    placement: string;
    agent: string;
    dateValue: string;
    materialCategory: string;
    newOrActive: string;
    newUserActivated: number;
    placer: string;
    bidType: string;
    materialDirection: string;
    bcDirection: string;
    materialDate: string;
    secondaryCategory: string;
    tertiaryCategory: string;
    creativeIdentityId: string;
    campaignId: string;
    cleanedMaterialName: string;
    adGroupId: string;
    adName: string;
    adId: string;
    creativeId: string;
    videoMaterialId: string;
    createdAt: string;
    updatedAt: string;
    groupName: string | null;
}

/** 投放数据明细表记录 */
export interface AdRecordDetail {
    id: string;
    adRecordId: string;
    cpaOriginal: number;
    cpmOriginal: number;
    playCount: number;
    play2s: number;
    play5s: number;
    playComplete: number;
    materialNameClean: string;
    audienceType: string;
    bcType: string;
    videoCompleteRate: number;
    avgVideoPlayDuration: number;
}

export interface AdRecordFull extends AdRecord {
    cpaOriginal: number | null;
    cpmOriginal: number;
    playCount: number;
    play2s: number;
    play5s: number;
    playComplete: number;
    materialNameClean: string;
    audienceType: string;
    bcType: string;
    videoCompleteRate: number;
    avgVideoPlayDuration: number;
    maxSettlementDate: string;
    nonSettlementCost: number;
}

// ============ 筛选参数 ============

/** 数据筛选参数 */
export interface AdDataFilterParams {
    dateStart?: string;  // 首消日期值：before/after 模式为单个日期，range 模式为 "YYYY-MM-DD~YYYY-MM-DD"
    dateMode?: 'before' | 'after' | 'range';  // 首消日期筛选模式
    materialType?: string[];
    agent?: string[];
    country?: string[];
    materialCategory?: string[];
    audienceType?: string[];
    newOrActive?: string[];
    materialDirection?: string[];
    placement?: string[];
    seriesNames?: string[];
    adGroupNames?: string[];
    creativeNames?: string[];
    keyword?: string;
    keywordFields?: string[];
    investTimeStart?: string;
    investTimeEnd?: string;
    investDaysMin?: number;
    investDaysMax?: number;
    yesterdayCostMin?: number;
    trustedData?: boolean;  // 已置信数据：仅展示 dateValue < T-8 的数据
    zeroCostOnly?: boolean;  // 0耗素材：仅展示7位创意ID的素材
    adGroupId?: string;
    adId?: string;
    creativeId?: string | string[];
    videoMaterialId?: string | string[];
    weekStartDay?: number;  // 周起始日：0=周日, 1=周一(默认), ..., 6=周六
    weekAnchorDate?: string;  // 周锚点日期：选中任意日期，定位到该日期所在的周
    weekCount?: number;  // 周复盘展示周数：1(默认)/2/4/8，从锚点周向前扩展
    creativeIdentityId?: string | string[];
    idSearch?: string[];
    advertiser?: string[];
    group?: string[];  // 组别筛选（组员映射最新生效组别，空/未传=全部组别）
    productionDateStart?: string;
    productionDateEnd?: string;
    productionDateEmpty?: boolean;
    renovationStatusFilter?: string;
}

// ============ 汇总卡片 ============

export interface SummaryData {
    totalCost: number;
    totalConversions: number;
    avgCost: number | null;
    prevCost: number | null;
}

// ============ 趋势 ============

export type TrendScope = 'all' | 'self';

export interface TrendItem {
    date: string;
    cost: number;
    cpa: number | null;
}

export interface TrendResponse {
    items: TrendItem[];
    selfItems: TrendItem[];
    marketItems: TrendItem[];
}

// ============ 报表行类型 ============

/** 报表聚合基础字段 */
export interface ReportBaseFields {
    totalCost: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    cpa: number | null;
    cpm: number | null;
    ctr: number | null;
}

/** 国家日报行 */
export interface CountryReportRow extends ReportBaseFields {
    country: string;
    date: string;
}

/** 环比基准行（按日期+国家聚合的消耗和付费量快照） */
export interface DailyBaselineRow {
    date: string;
    country: string;
    totalCost: number;
    totalConversions: number;
    laxinCost: number;
    laxinConversions: number;
    lahuoCost: number;
    lahuoConversions: number;
    lishiCost: number;
    lishiConversions: number;
}

/** 环比基准响应 */
export interface DailyBaselineResponse {
    items: DailyBaselineRow[];
}

/** 素材类型日报行（按日期透视各素材类型消耗） */
export interface MaterialTypeReportRow {
    date: string;
    totalCost: number;
    ugcStory: number;
    aigc: number;
    ae: number;
    studio: number;
    other: number;
    actualShoot: number;
    editing: number;
    revenueEstimate1: number;
    revenueEstimate2: number;
    ugcRatio: number;
    aiRatio: number;
    aeRatio: number;
}

/** 周复盘行 */
export interface WeeklyReportRow extends ReportBaseFields {
    weekStart: string;
    weekEnd: string;
}

/** 代理商日报行 */
export interface AgentReportRow extends ReportBaseFields {
    agent: string;
    date: string;
}

/** 日报表行（按日期+国家+素材-拉新拉活+二级分类+三级分类 聚合） */
export interface DailyReportRow {
    date: string;
    country: string;
    materialNewOrActive: string;
    audienceCategory: string;
    directionCategory: string;
    totalCost: number;
    totalConversions: number;
    newUserActivated: number;
}

// ============ 列表响应 ============

export interface AdDataListParams extends AdDataFilterParams {
    page?: number;
    pageSize?: number;
    sortField?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface SourceTableSummary {
    totalCost: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    totalNewUserActivated: number;
    totalPlay2s: number;
    totalPlayComplete: number;
    avgVideoPlayDuration: number | null;
    cpa: number | null;
    ctr: number | null;
}

export interface AdDataListResponse {
    items: AdRecordFull[];
    total: number;
    summary?: SourceTableSummary | null;
}

export interface ReportListResponse<T> {
    items: T[];
    total: number;
}

// ============ 筛选选项 ============

export interface FilterOptions {
    countries: string[];
    materialTypes: string[];
    agents: string[];
    materialCategories: string[];
    audienceTypes: string[];
    newOrActive: string[];
    materialDirections: string[];
    placements: string[];
    seriesNames: string[];
    adGroupNames: string[];
    creativeNames: string[];
    advertisers: string[];
}

// ============ 上传相关 ============

export interface UploadRequest {
    fileName: string;
    downloadUrl: string;
}

export interface UploadResponse {
    success: boolean;
    totalRows: number;
    validRows: number;
    dataDateStart: string;
    dataDateEnd: string;
    errors?: string[];
}

export interface BatchUploadFileItem {
    fileName: string;
    downloadUrl: string;
}

export type UploadMode =
    'daily_morning'
    | 'hourly_noon'
    | 'hourly_first'
    | 'hourly_second'
    | 'hourly_third'
    | 'zero_cost'
    | 'paired';

export interface BatchUploadRequest {
    files: BatchUploadFileItem[];
    uploadMode?: UploadMode;
    baselineDate?: string;
}

export interface BatchUploadFileResult {
    fileName: string;
    success: boolean;
    totalRows: number;
    validRows: number;
    errorMsg?: string;
    errors?: string[];
}

export interface UnmatchedCreativeDetail {
    creativeId: string;
    cost: number;
}

export interface BatchUploadResponse {
    success: boolean;
    totalRows: number;
    validRows: number;
    dataDateStart: string;
    dataDateEnd: string;
    fileResults: BatchUploadFileResult[];
    errors?: string[];
    unmatchedCost?: number;
    unmatchedDetails?: UnmatchedCreativeDetail[];
}

export interface BatchPollResponse {
    found: boolean;
    status?: UploadStatus;
    result?: BatchUploadResponse;
    errorMessage?: string;
    progress?: number;
    stage?: string;
}

export type UploadStatus = 'processing' | 'success' | 'failed';

export interface CampaignMappingUploadRequest {
    fileName: string;
    downloadUrl: string;
}

export interface CampaignMappingUploadResponse {
    success: boolean;
    totalRows: number;
    updatedRows: number;
    matchedCampaigns: number;
    errors?: string[];
}

export interface MappingRefreshRequest {
    fileName: string;
    downloadUrl: string;
}

export interface MappingRefreshResponse {
    success: boolean;
    totalMappingRows: number;
    matchedCreativeIds: number;
    scannedDataSourceRows: number;
    updatedDataSourceRows: number;
    errors?: string[];
}

export interface UploadRecord {
    id: string;
    fileName: string;
    status: UploadStatus;
    totalRows: number;
    validRows: number;
    errorMessage: string;
    dataDateStart: string;
    dataDateEnd: string;
    processedAt: string;
    startedAt: string;
}

export interface UploadRecordListParams {
    page?: number;
    pageSize?: number;
}

export interface UploadRecordListResponse {
    items: UploadRecord[];
    total: number;
}

// ============ 清空近8日数据 ============

export interface ClearRecentDataResponse {
    success: boolean;
    dateStart: string;
    dateEnd: string;
    deletedCount: number;
    backupBatchId: string;
}

/** 国家时报行（按日期+时段+国家聚合，含环比） */
export interface CountryTimesReportRow {
    date: string;
    timeSlot: '12:00' | '16:00' | '22:00' | '24:00';
    country: string;
    totalCost: number;
    ccRatio: number;
    lcRatio: number;
    cpa: number | null;
}

/** 国家时报响应 */
export interface CountryTimesReportResponse {
    items: CountryTimesReportRow[];
    total: number;
}

/** 对客日报 — 合计指标（无NCA） */
export interface DuiKeDailyBaseMetrics {
    materialCount: number;
    cost: number;
    conversions: number;
    cpa: number | null;
}

/** 对客日报 — 按广告类型指标（含NCA） */
export interface DuiKeDailyAdTypeMetrics extends DuiKeDailyBaseMetrics {
    nca: number;
    ncaCpa: number | null;
}

/** 对客日报行数据 */
export interface DuiKeDailyReportRow {
    groupName: string;
    date: string;
    dateOffset: number;
    total: DuiKeDailyBaseMetrics;
    laxin: DuiKeDailyAdTypeMetrics;
    lahuo: DuiKeDailyAdTypeMetrics;
    lishi: DuiKeDailyAdTypeMetrics;
    grandTotalCost: number;
    roi: number | null;
    laxinRoiCompletionRate: number | null;
}

/** 对客日报响应 */
export interface DuiKeDailyReportResponse {
    items: DuiKeDailyReportRow[];
}

/** 备份表信息 */
export interface BackupTableInfo {
    tableId: number;
    tableName: string;
    rowCount: number;
    dateCount: number;
    minDate: string;
    maxDate: string;
    dates: string[];
}

/** 备份表列表响应 */
export interface BackupTableListResponse {
    tables: BackupTableInfo[];
}

/** 外部 RDB 会话诊断：单个活动会话 */
export interface DiagDbActivitySession {
    pid: number;
    usename: string;
    state: string;
    waitEventType: string;
    waitEvent: string;
    xactSecs: number | null;
    querySecs: number | null;
    query: string;
}

/** 外部 RDB 会话诊断：锁阻塞关系 */
export interface DiagDbBlockingPair {
    blockedPid: number;
    blockingPid: number;
    blockingState: string;
    blockingXactSecs: number | null;
    blockingQuery: string;
}

/** 外部 RDB 会话诊断响应 */
export interface DiagDbActivityResponse {
    sessions: DiagDbActivitySession[];
    blocking: DiagDbBlockingPair[];
}

/** 备份表数据查询参数 */
export interface BackupTableDataParams {
    tableId: number;
    date?: string;
    page: number;
    pageSize: number;
}

/** 备份表数据行 */
export interface BackupTableRow {
    id: string;
    dateValue: string;
    seriesName: string;
    recordDate: string;
    adGroupName: string;
    creativeName: string;
    cleanedMaterialName: string;
    cost: string;
    impressions: number;
    clicks: number;
    conversions: number;
    country: string;
    materialType: string;
    placement: string;
    agent: string;
    materialCategory: string;
    newOrActive: string;
    newUserActivated: number;
    placer: string;
    bidType: string;
    materialDirection: string;
    bcDirection: string;
    materialDate: string;
    secondaryCategory: string;
    tertiaryCategory: string;
    creativeIdentityId: string;
    adGroupId: string;
    adName: string;
    adId: string;
    creativeId: string;
    videoMaterialId: string;
}

/** 备份表数据响应 */
export interface BackupTableDataResponse {
    items: BackupTableRow[];
    total: number;
    page: number;
    pageSize: number;
    dates: string[];
}

/** 素材分天消耗行 */
export interface MaterialDailyConsumptionRow {
    videoMaterialId: string;
    creativeName: string;
    creativeNames?: string[];
    materialNameClean: string;
    materialType: string;
    country: string;
    productionDate: string;
    uploadDate: number;
    totalCost: number;
    yesterdayCost: number;
    productionCapacity: number;
    rangeCost?: number;
    renovationStatus: string;
    renovationMaterialIds: string[];
    renovationIdsAligned: string;
    renovationCountries: string;
    renovationRequestDates: string;
    directorTeamGroup: string;
    postTeamGroup: string;
    lastCostDate: string;
    adGroupNames: string;
    infrastructureCount: number;
}

export interface MaterialDailySummary {
    totalCost: number;
    totalYesterdayCost: number;
    totalRangeCost: number | null;
}

/** 素材分天消耗响应 */
export interface MaterialDailyConsumptionResponse {
    items: MaterialDailyConsumptionRow[];
    total: number;
    summary?: MaterialDailySummary | null;
}

/** 制作日期审计冲突条目 */
export interface ProductionDateConflictItem {
    source: 'override' | 'registry' | 'assetsExport';
    videoMaterialId?: string;
    materialName: string;
    currentDate: string;
    regexDate: string;
    manual: boolean;
    updatedBy?: string;
}

/** 制作日期审计响应 */
export interface ProductionDateAuditResponse {
    overrideTotal: number;
    registryDatedTotal: number;
    assetsExportDatedTotal: number;
    conflictCount: number;
    manualConflictCount: number;
    conflicts: ProductionDateConflictItem[];
}

/** 制作日期历史脏数据清理响应 */
export interface FixLegacyProductionDatesResponse {
    dryRun: boolean;
    clearedMarkers: number;
    removedOverrides: number;
    fixedRegistry: number;
    fixedAssetsExport: number;
    backfilledMissing: number;
}

// ============ 导出相关 ============

export type ReportType =
    'source'
    | 'country'
    | 'country-pivot'
    | 'material-type'
    | 'weekly'
    | 'agent'
    | 'backup'
    | 'daily'
    | 'atomic'
    | 'country-times'
    | 'material-daily'
    | 'material-weekly'
    | 'duike-daily'
    | 'seven-by-seven'
    | 'material-monthly'
    | 'custom-table'
    | 'team-tier'
    | 'monthly-tier'
    | 'monthly-distribution'
    | 'country-registry'
    | 'market-consumption';

// ============ 大盘日耗录入 ============

export interface MarketConsumptionRow {
    id: string;
    day: string;
    region: string;
    consumption: number | null;
}

export interface MarketConsumptionListResponse {
    items: MarketConsumptionRow[];
}

export interface UpdateMarketConsumptionRequest {
    consumption: number | null;
}

export interface AddMarketConsumptionDayRequest {
    day: string;
    endDay?: string;
}

export interface AddMarketConsumptionDayResponse {
    items: MarketConsumptionRow[];
    created: number;
}

export interface MarketConsumptionSummaryResponse {
    summary: Record<string, number | null>;
}

/** 素材分层周会单元格数据 */
export interface MaterialWeeklyCellData {
    count: number;
    cost: number;
    countRatio: number;
    costRatio: number;
}

/** 素材分层周会行 */
export interface MaterialWeeklyTierRow {
    tier: string;
    summary: MaterialWeeklyCellData;
    liveAction: MaterialWeeklyCellData;
    aigc: MaterialWeeklyCellData;
    ae: MaterialWeeklyCellData;
    studio: MaterialWeeklyCellData;
    globalActor: MaterialWeeklyCellData;
}

/** 素材分层周会响应 */
export interface MaterialWeeklyReportResponse {
    items: MaterialWeeklyTierRow[];
}

/** 素材分层周会请求参数 */
export interface MaterialWeeklyParams extends AdDataFilterParams {
    productionDateStart: string;
    productionDateEnd: string;
    consumptionDateStart: string;
    consumptionDateEnd: string;
}

/** 素材分层钻取明细项 */
export interface MaterialWeeklyDetailItem {
    videoMaterialId: string;
    materialNameClean: string;
    materialType: string;
    cost: number;
    conversions: number;
    cpa: number | null;
    clicks: number;
    impressions: number;
    ctr: number | null;
    conversionRate: number | null;
    play2s: number;
    playCount: number;
    play2sRate: number | null;
    playComplete: number;
    playCompleteRate: number | null;
    videoUrl: string | null;
    productionDate: string;
}

/** 素材分层钻取明细响应 */
export interface MaterialWeeklyDetailSummary {
    totalCost: number;
    totalConversions: number;
    cpa: number | null;
    totalClicks: number;
    totalImpressions: number;
    ctr: number | null;
    conversionRate: number | null;
    totalPlay2s: number;
    totalPlayCount: number;
    play2sRate: number | null;
    totalPlayComplete: number;
    playCompleteRate: number | null;
}

export interface MaterialWeeklyDetailResponse {
    items: MaterialWeeklyDetailItem[];
    total: number;
    tier: string;
    typeGroup: string;
    summary?: MaterialWeeklyDetailSummary | null;
}

/** 素材分层月会响应（与周会结构一致，仅梯队阈值不同） */
export interface MaterialMonthlyReportResponse {
    items: MaterialWeeklyTierRow[];
}

/** 素材分层月会请求参数 */
export interface MaterialMonthlyParams extends AdDataFilterParams {
    productionDateStart: string;
    productionDateEnd: string;
    consumptionDateStart: string;
    consumptionDateEnd: string;
}

/** 素材分层周会全量明细响应 */
export interface MaterialWeeklyAllDetailResponse {
    items: MaterialWeeklyDetailItem[];
    total: number;
    summary?: MaterialWeeklyDetailSummary | null;
}

/** 自然月消耗分布数据请求参数 */
export interface MonthlyDistributionParams {
    n: number;
    agent?: string[];
    country?: string[];
    materialType?: string[];
    materialCategory?: string[];
    newOrActive?: string[];
    materialDirection?: string[];
    bcDirection?: string[];
    secondaryCategory?: string[];
    tertiaryCategory?: string[];
    placer?: string[];
    bidType?: string[];
}

/** 自然月消耗分布数据行 */
export interface MonthlyDistributionRow {
    consumptionMonth: string;
    cells: { productionMonth: string; cost: number }[];
    totalCost: number;
    nonSettlementCost: number;
    settlementCost: number;
    nonSettlementRatio: number;
}

/** 自然月消耗分布响应 */
export interface MonthlyDistributionResponse {
    rows: MonthlyDistributionRow[];
    productionMonths: string[];
    startMonth: string;
}

/** 素材分层钻取明细请求参数 */
export interface MaterialWeeklyDetailParams extends MaterialWeeklyParams {
    tier: string;
    typeGroup: string;
    page?: number;
    pageSize?: number;
    mode?: 'weekly' | 'monthly';
}

/** N+N分周/分月单元格数据 */
export interface SevenBySevenCellData {
    /** 产出数 */
    count: number;
    /** N+N期新素材累计消耗 */
    cost: number;
    /** ARPU值 = 新素材消耗 / 产出数 */
    arpu: number;
    /** 新素材消耗占比 = 新素材消耗 / 所有素材总消耗 */
    newCostRatio: number;
    /** N+N期所有素材总消耗 */
    totalCost: number;
    /** 潜力素材消耗占比 = 消耗>$3000的新素材消耗 / 新素材总消耗 */
    potentialCostRatio: number;
    /** 人数（前端自定义输入后回传参与计算，后端默认0） */
    headcount: number;
    /** 人均新素材日消耗 = 新素材消耗 / 人数 / N+N天 */
    perCapitaDailyCost: number;
    /** 人均产出素材数 = 产出数 / 人数（保留，暂不展示） */
    perCapitaOutput: number;
}

/** N+N分周/分月行 */
export interface SevenBySevenRow {
    productionWeek: string;   // 产出周/月标签
    /** 消耗数据是否不完整（消耗窗口超出当前日期） */
    dataIncomplete?: boolean;
    summary: SevenBySevenCellData;
    liveAction: SevenBySevenCellData;  // 实拍 = UGC
    aigc: SevenBySevenCellData;
    ae: SevenBySevenCellData;
    studio: SevenBySevenCellData;
    globalActor: SevenBySevenCellData;
}

/** N+N分周/分月响应 */
export interface SevenBySevenReportResponse {
    items: SevenBySevenRow[];
    /** N+N 观察周期天数（后端根据 productionRange + consumptionRange 计算，或直接返回 N+N） */
    observationDays: number;
}

/** N+N分月模式下每组的独立配置 */
export interface SevenBySevenGroupConfig {
    /** 组名，如 1组、2组、3组 */
    label: string;
    /** 产出起始（YYYYMMDD） */
    productionDateStart: string;
    /** 产出结束（YYYYMMDD） */
    productionDateEnd: string;
    /** 观察起始（YYYYMMDD），不传则 = 产出起始 */
    consumptionDateStart?: string;
    /** 观察结束（YYYYMMDD），不传则 = 产出结束 + observationWindowDays - 1 */
    consumptionDateEnd?: string;
}

/** N+N分周/分月请求参数 */
export interface SevenBySevenParams extends AdDataFilterParams {
    /** 分周/分月模式 */
    mode?: 'weekly' | 'monthly';
    /** 分周模式：制作日期步长N1（默认7） */
    groupDays?: number;
    /** 分周模式：呈现几组（默认3） */
    groupCount?: number;
    /** 分周模式：潜力素材消耗阈值（美元，默认 3000） */
    potentialThreshold?: number;
    /** 分周模式：消耗日期步长 = N1+N2（默认 = groupDays * 2），控制消耗窗口长度 */
    consumptionDays?: number;
    /** @deprecated 分周模式：N天观察窗口，已由 consumptionDays 替代 */
    observationWindowDays?: number;
    /** 分周模式：产出起始日期（YYYYMMDD），默认上一个完整周结束 */
    productionDateStart?: string;
    /** 分周模式：产出结束日期（YYYYMMDD，可选），提供时与 productionDateStart 组成产出日期范围，起始日晚于该日的组被截断 */
    productionDateEnd?: string;
    /** 分月模式：爆款阈值（美元，默认 3000） */
    hitThreshold?: number;
    /** 分月模式：组数，默认3 */
    monthGroupCount?: number;
    /** 分月模式：各组独立配置（JSON 数组字符串），优先级最高 */
    groupConfigs?: string;
    /** @deprecated 旧参数，分月模式下由 groupConfigs 配置 */
    consumptionDateStart?: string;
    /** @deprecated 旧参数，分月模式下由 groupConfigs 配置 */
    consumptionDateEnd?: string;
}

/** 小组分层单元格数据（分周/分月模式，每个组一列） */
export interface TeamTierWeeklyCell {
    /** 产能（素材数量） */
    count: number;
    /** 新素材消耗 */
    cost: number;
    /** ARPU值 = 新素材消耗 / 产出数 */
    arpu: number;
    /** 新素材消耗占比 = 新素材消耗 / 所有素材总消耗 */
    newCostRatio: number;
    /** 所有素材总消耗 */
    totalCost: number;
    /** 爆款素材消耗占比 */
    potentialCostRatio: number;
    /** 组员人数（前端自定义输入） */
    headcount: number;
    /** 人均新素材日消耗 = 新素材消耗 / 人数 / N+N天 */
    perCapitaDailyCost: number;
}

/** 小组分层分周行（行=团队，列=周/月） */
export interface TeamTierWeeklyRow {
    /** 团队名称 */
    teamName: string;
    /** 消耗数据是否不完整（任一观察周不完整即标） */
    dataIncomplete?: boolean;
    /** 各产出周/月数据，key=组标签 */
    weeks: Record<string, TeamTierWeeklyCell>;
    /** 跨周/月项目汇总 */
    summary: TeamTierWeeklyCell;
}

/** 小组分层分周响应 */
export interface TeamTierWeeklyResponse {
    items: TeamTierWeeklyRow[];
    /** 组标签列表（列顺序） */
    weekLabels: string[];
    /** N+N 观察周期天数（分周模式用） */
    observationDays: number;
}

/** 小组分层分层模式单元格（每个小组一列） */
export interface TeamTierLadderCell {
    count: number;
    cost: number;
    countRatio: number;
    costRatio: number;
}

/** 小组分层分层模式行 */
export interface TeamTierLadderRow {
    tier: string;
    summary: TeamTierLadderCell;
    groups: Record<string, TeamTierLadderCell>;
}

/** 小组分层分层模式响应 */
export interface TeamTierLadderResponse {
    items: TeamTierLadderRow[];
    groupNames: string[];
}

/** 月分层单元格（每个后期组一列） */
export interface MonthlyTierCell {
    count: number;
    cost: number;
    arpu: number;
    countRatio: number;
    costRatio: number;
}

/** 月分层行 */
export interface MonthlyTierRow {
    tier: string;
    summary: MonthlyTierCell;
    groups: Record<string, MonthlyTierCell>;
}

/** 月分层响应 */
export interface MonthlyTierResponse {
    items: MonthlyTierRow[];
    groupNames: string[];
    /** 首消日期在消耗窗口末日之后、仍计入当期 0 耗的素材数 */
    zeroCostAfterWindowCount?: number;
}

/** 月分层请求参数 */
export interface MonthlyTierParams extends AdDataFilterParams {
    productionDateStart?: string;
    productionDateEnd?: string;
    consumptionDateStart?: string;
    consumptionDateEnd?: string;
}

/** 小组分层请求参数 */
export interface TeamTierParams extends AdDataFilterParams {
    /** 分周/分层/分月模式 */
    mode: 'weekly' | 'ladder' | 'monthly';
    /** 分周模式：产出日期步长N1（默认7） */
    groupDays?: number;
    /** 分周模式：呈现几组（默认3） */
    groupCount?: number;
    /** 分周/分月模式：爆款素材消耗阈值（美元） */
    potentialThreshold?: number;
    /** 分周模式：消耗日期步长 = N1+N2（默认 = groupDays * 2） */
    consumptionDays?: number;
    /** 分周模式：产出起始日期（YYYYMMDD） */
    productionDateStart?: string;
    /** 分周模式：产出结束日期（YYYYMMDD，可选），与 productionDateStart 组成产出日期范围过滤 */
    productionDateEnd?: string;
    /** 分层模式：产出日期范围起 */
    productionDateStartLadder?: string;
    /** 分层模式：产出日期范围止 */
    productionDateEndLadder?: string;
    /** 分层模式：消耗日期范围起 */
    consumptionDateStart?: string;
    /** 分层模式：消耗日期范围止 */
    consumptionDateEnd?: string;
    /** 分月模式：月度分组配置（每个组有独立产出/消耗日期范围） */
    monthGroups?: TeamTierMonthGroup[];
}

export interface TeamTierMonthGroup {
    /** 组标签，如"6月-7" */
    label: string;
    /** 产出日期起 YYYYMMDD */
    productionDateStart: string;
    /** 产出日期止 YYYYMMDD */
    productionDateEnd: string;
    /** 消耗日期起 YYYY-MM-DD */
    consumptionDateStart: string;
    /** 消耗日期止 YYYY-MM-DD */
    consumptionDateEnd: string;
}

/** 小组分层明细项 */
export interface TeamTierDetailItem {
    videoMaterialId: string;
    materialNameClean: string;
    materialType: string;
    teamGroup: string;
    cost: number;
    conversions: number;
    cpa: number | null;
    clicks: number;
    impressions: number;
    ctr: number | null;
    conversionRate: number | null;
    play2s: number;
    playCount: number;
    play2sRate: number | null;
    playComplete: number;
    playCompleteRate: number | null;
    videoUrl: string | null;
}

/** 小组分层明细汇总 */
export interface TeamTierDetailSummary {
    totalCost: number;
    totalConversions: number;
    cpa: number | null;
    totalClicks: number;
    totalImpressions: number;
    ctr: number | null;
    conversionRate: number | null;
    totalPlay2s: number;
    totalPlayCount: number;
    play2sRate: number | null;
    totalPlayComplete: number;
    playCompleteRate: number | null;
}

/** 小组分层明细响应 */
export interface TeamTierDetailResponse {
    items: TeamTierDetailItem[];
    total: number;
    summary: TeamTierDetailSummary;
}

export interface CapacityDemandColumn {
    id: number;
    name: string;
    colType: 'text' | 'number';
    groupKey: string;
    sortOrder: number;
}

export interface CapacityDemandRow {
    id: number;
    week: string;
    region: string;
    countryCode: string;
    countryName: string;
    creativeOwner: string;
    adOwner: string;
    priority: string | null;
    demandLive: string | null;
    demandTts: string | null;
    demandNonshop: string | null;
    demandGeneral: string | null;
    liveAction: string | null;
    editAe: string | null;
    editAigc: string | null;
    liveStudio: string | null;
    liveTts: string | null;
    liveNonshop: string | null;
    liveGeneral: string | null;
    aeLive: string | null;
    aeTts: string | null;
    aeNonshop: string | null;
    aeGeneral: string | null;
    aigcLive: string | null;
    aigcTts: string | null;
    aigcNonshop: string | null;
    aigcGeneral: string | null;
    remark: string;
    customData: Record<string, string | number | null>;
}

export interface CapacityCountryStats {
    submittedNotDownloaded: number;
    inAudit: number;
    notSubmitted: number;
}

export interface CapacityWeekActuals {
    liveStudio: number | null;
    liveTts: number | null;
    liveNonshop: number | null;
    liveGeneral: number | null;
    aeLive: number | null;
    aeTts: number | null;
    aeNonshop: number | null;
    aeGeneral: number | null;
    aigcLive: number | null;
    aigcTts: number | null;
    aigcNonshop: number | null;
    aigcGeneral: number | null;
}

export type CapacityWeekActualsPatch = Partial<CapacityWeekActuals>;

export interface CapacityDemandListResponse {
    items: CapacityDemandRow[];
    total: number;
    stats: Record<string, CapacityCountryStats>;
    actuals: CapacityWeekActuals;
    columns: CapacityDemandColumn[];
}

export interface CapacityWeekItem {
    week: string;
    label: string;
}

export interface CapacityWeeksResponse {
    weeks: CapacityWeekItem[];
    defaultWeek: string;
}

export type CapacityDemandRowPatch = Partial<
    Omit<CapacityDemandRow, 'id' | 'week'>
> & { customData?: Record<string, string | number | null> };

export interface CapacityDemandCreateColumnBody {
    name: string;
    colType: 'text' | 'number';
    groupKey: string;
}

export interface CapacityDemandCreateBody {
    week: string;
    region?: string;
    countryCode?: string;
    countryName?: string;
    creativeOwner?: string;
    adOwner?: string;
}

export interface ExportParams extends AdDataFilterParams {
    reportType: ReportType;
    consumptionDateStart?: string;
    consumptionDateEnd?: string;
    source?: string;
    fields?: string[];
    groupBy?: string[];
}

export interface ExportResponse {
    downloadUrl: string;
    rowCount: number;
}

export interface CustomTableExportParams extends AdDataFilterParams {
    fields: string[];
}

// ============ 最新更新时间 ============

export interface LastUpdatedResponse {
    lastUpdated: string;
}

export interface LatestDataDateResponse {
    latestDataDate: string;
}

// ============ 数据备份 ============

export type BackupStatus = 'active' | 'deleted';

export interface DataBackup {
    id: string;
    batchId: string;
    backupDate: string;
    dataDateStart: string;
    dataDateEnd: string;
    rowCount: number;
    status: BackupStatus;
}

export interface BackupDataParams {
    dateStart?: string;
    dateEnd?: string;
    page?: number;
    pageSize?: number;
}

export interface BackupDataListResponse {
    items: AdRecordFull[];
    total: number;
    batches: DataBackup[];
}

// ============ 自定义表格 ============

/** 字段元数据 */
export interface FieldMeta {
    key: string;
    label: string;
    category: 'main' | 'detail' | 'registry' | 'dimension' | 'measure';
    role: 'dimension' | 'measure';
    type: 'text' | 'number' | 'date';
    source?: string;
}

/** 自定义表格字段列表响应 */
export interface CustomTableFieldsResponse {
    fields: FieldMeta[];
}

/** 数据源元数据 */
export interface CustomTableSourceMeta {
    id: string;
    label: string;
    fields: FieldMeta[];
}

/** 数据源列表响应 */
export interface CustomTableSourcesResponse {
    sources: CustomTableSourceMeta[];
}

/** 下钻路径步骤（某个维度字段被展开选中的值） */
export interface DrillPathStep {
    field: string;
    value: string;
}

/** 自定义表格数据查询参数 */
export interface CustomTableListParams extends AdDataFilterParams {
    source?: string;
    fields: string[];
    page?: number;
    pageSize?: number;
    sortField?: string;
    sortOrder?: 'asc' | 'desc';
    /** 是否启用维度下钻聚合模式 */
    drillDown?: boolean;
    /** 已展开的祖先维度路径（按层级顺序） */
    drillPath?: DrillPathStep[];
    /** 导出/聚合时按哪些维度字段分组（=行维度+列维度），为空则导明细 */
    groupBy?: string[];
}

/** 自定义表格聚合模式 */
export type AggregationMode = 'none' | 'material' | 'date';

/** 自定义表格数据响应 */
export interface CustomTableListResponse {
    items: Record<string, string | number | null>[];
    total: number;
    aggregationMode?: AggregationMode;
    summary?: Record<string, string | number | null> | null;
    /** 下钻模式：有序的维度层级（聚合顺序） */
    groupBy?: string[];
    /** 下钻模式：当前层用于分组的维度字段 */
    levelField?: string;
    /** 下钻模式：当前层级（0 起） */
    level?: number;
    /** 下钻模式：当前层的行是否还能继续下钻 */
    hasChildren?: boolean;
    /** 下钻模式：回显当前查询的下钻路径 */
    drillPath?: DrillPathStep[];
}

// ============ 用户表格偏好 ============

/** 用户表格字段偏好响应 */
export interface TablePreferencesResponse {
    fieldsBySource: Record<string, string[]>;
    activeSource: string | null;
}

/** 保存用户表格字段偏好请求 */
export interface SaveTablePreferencesRequest {
    fieldsBySource: Record<string, string[]>;
    activeSource: string | null;
}

// ============ 表格视图管理 ============

/** 透视值字段配置（字段 + 聚合方式） */
export interface PivotValueConfig {
    fieldKey: string;
    aggregation: string;
    showAs?: string;
    label?: string;
}

/** 透视布局：字段在筛选/行/列/值四个区域的归属 */
export interface PivotLayoutConfig {
    filters: string[];
    rows: string[];
    columns: string[];
    values: PivotValueConfig[];
}

/** 表格视图 */
export interface TableView {
    id: string;
    name: string;
    source: string;
    fields: string[];
    /** 透视布局（区域归属 + 聚合方式）；旧视图无此字段 */
    pivot?: PivotLayoutConfig | null;
    scope: 'personal' | 'shared';
    createdAt: string;
    updatedAt: string;
}

/** 创建视图请求 */
export interface CreateTableViewRequest {
    name: string;
    source: string;
    fields: string[];
    pivot?: PivotLayoutConfig | null;
    scope?: 'personal' | 'shared';
}

/** 更新视图请求 */
export interface UpdateTableViewRequest {
    name?: string;
    source?: string;
    fields?: string[];
    pivot?: PivotLayoutConfig | null;
    scope?: 'personal' | 'shared';
}

/** 视图列表响应 */
export interface TableViewListResponse {
    items: TableView[];
}

// ============ API 数据接入（预留） ============

export interface DataImportRequest {
    source: string;
    query: string;
    mapping: Record<string, unknown>;
}

export interface DataImportResponse {
    code: number;
    message: string;
    data: { rowsImported: number };
}

// ============ NCA 数据源 ============

export interface NcaRecord {
    id: string;
    sourceDate: string;
    campaignId: string;
    adGroupId: string;
    advertiserId: string;
    adGroupName: string;
    country: string;
    newOrReactivate: string;
    campaignName: string;
    cost: string;
    paidQuantityWeb: string;
    cpa: string;
    ncaCpa: string;
    newUserActivated: string;
    paidAdCost: string;
}

export interface NcaListParams {
    sourceDateStart?: string;
    sourceDateEnd?: string;
    campaignId?: string;
    keyword?: string;
    keywordFields?: string[];
    ncaCountries?: string[];
    newOrReactivate?: string;
    page?: number;
    pageSize?: number;
    sortField?: string;
    sortOrder?: 'asc' | 'desc';
    dateField?: string;
}

export interface NcaRawRecord {
    id: string;
    sourceDate: string;
    campaignId: string;
    adGroupId: string;
    creativeId: string;
    advertiserId: string;
    ncaCpa: string;
    newUserActivated: string;
    paidAdCost: string;
    adGroupName: string;
}

export interface NcaRawListResponse {
    items: NcaRawRecord[];
    total: number;
    summary?: NcaRawSummary | null;
}

export interface NcaRawSummary {
    avgNcaCpa: string;
    totalNewUserActivated: string;
    totalPaidAdCost: string;
}

export interface NcaListResponse {
    items: NcaRecord[];
    total: number;
    summary?: NcaSummary | null;
}

export interface NcaSummary {
    totalPaidAdCost: number;
    totalNewUserActivated: number;
    avgNcaCpa: number | null;
    totalCost: number;
    totalPaidQuantityWeb: number;
    avgCpa: number | null;
}

export interface NcaUploadRequest {
    fileName: string;
    downloadUrl: string;
}

export interface NcaUploadResponse {
    success: boolean;
    totalRows: number;
    validRows: number;
    dataDateStart: string;
    dataDateEnd: string;
    promoteMatched?: number;
    errors?: string[];
}

export interface NcaDeleteResponse {
    success: boolean;
    deletedCount: number;
}

export interface NcaNormalizeDateResponse {
    success: boolean;
    updatedCount: number;
    totalCount: number;
    invalidCount: number;
    dedupRemovedCount: number;
}

// ============ NCA 结算 ============

export interface NcaAssessmentRecord {
    seq: number;
    countryCode: string;
    countryName: string;
    roiAssessment: string;
    newAssessment: string;
    reactivateAssessment: string;
    ncaAssessment: string;
}

export interface NcaSettlementRecord {
    region: string;
    country: string;
    countryCode: string;
    totalCost: number;
    ratio: number;
    newCost: number;
    newCpa: number | null;
    newRoiAssessment: string;
    reactivateCost: number;
    reactivateCpa: number | null;
    historyCost: number;
    historyNcaCpa: number | null;
    newCpaAssessment: string;
    reactivateCpaAssessment: string;
    historyNcaCpaAssessment: string;
    newConversions: number;
    reactivateConversions: number;
    ncaConversions: number;
    newCompletionRate: string;
    reactivateCompletionRate: string;
    historyCompletionRate: string;
}

export interface NcaSettlementResponse {
    dateLabel: string;
    items: NcaSettlementRecord[];
    grandTotal: number;
}

// ============ Creative Assets Export 数据源 ============

export interface CreativeAssetsRecord {
    id: string;
    timeRange: string;
    creativeName: string;
    createdTime: string;
    creativeSource: string;
    country: string;
    placement: string;
    relatedAdCount: number;
    cost: number;
    cpm: number;
    impressions: number;
    clicksLandingPage: number;
    ctrLandingPage: number;
    cleanedMaterialName: string;
    materialDate: string;
    zeroCostFlag: string;
    firstCostDate: string;
    videoMaterialId: string;
    isManualDate: boolean;
}

export interface CreativeAssetsListParams {
    timeRange?: string;
    country?: string;
    placement?: string;
    creativeSource?: string;
    keyword?: string;
    keywordFields?: string[];
    materialDateFrom?: string;
    materialDateTo?: string;
    zeroCostOnly?: boolean;
    page?: number;
    pageSize?: number;
    sortField?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface CreativeAssetsListResponse {
    items: CreativeAssetsRecord[];
    total: number;
}

export interface CreativeAssetsSummary {
    totalCost: number;
    totalImpressions: number;
    totalClicks: number;
    totalRelatedAds: number;
}

export interface CreativeAssetsUploadRequest {
    fileName: string;
    downloadUrl: string;
}

export interface CreativeAssetsUploadResponse {
    success: boolean;
    totalRows: number;
    validRows: number;
    errors?: string[];
}

export interface CreativeAssetsLatestDate {
    latestDate: string | null;
}

export interface PushZeroCostResponse {
    success: boolean;
    pushedCount: number;
    deletedCount: number;
    message: string;
}

export interface CreativeAssetRegistryRecord {
    id: string;
    identityCardId: string;
    finalName: string;
    director: string;
    functionName: string;
    requirement: string;
    painPoint: string;
    molecule: string;
    productionType: string;
    hookType: string;
    openingScene: string;
    validElements: string;
    validLocations: string;
    scriptTags: string;
    scriptTagLevel1: string;
    scriptTagLevel2: string;
    lateEditor: string;
    country: string;
    sourceTable: string;
    sourceTableId: string;
    bitableRecordId: string;
    useCase: string;
    createdAt: string;
    updatedAt: string;
    cost: number | null;
    clicks: number | null;
    impressions: number | null;
    conversions: number | null;
    ctr: number | null;
    cpa: number | null;
    conversionRate: number | null;
    play2s: number | null;
    playCount: number | null;
    playComplete: number | null;
    videoPlay2sRate: number | null;
    videoCompleteRate: number | null;
    avgVideoPlayDuration: number | null;
    arpu: number | null;
    newOrActive: string;
    materialType: string;
    productionStatus: string;
    auditStatus: string;
    materialDate: string;
    materialDatePlus3: string;
    monitoringStatus: string;
    firstCostDate: string | null;
    investmentDays: number | null;
    dailyAvgCost: number | null;
    week: string;
    teamLeader: string;
    sourceType: string;
    videoUrl: string | null;
    rejectionReason: string;
}

export interface CapacityPlanningRecord {
    id: string;
    week: string;
    country: string;
    groupMembers: string;
    targetCount: number;
    sourceType: string;
    industry: string;
    categoryLevel1: string;
    functionName: string;
    requirement: string;
    painPoint: string;
    categoryLevel2: string;
    categoryLevel3: string;
    remark: string;
    submittedCount: number;
    deliveryProgress: number | null;
}

export interface CapacityPlanningListParams {
    page?: number;
    pageSize?: number;
    week?: string;
    country?: string;
    groupMembers?: string;
    sourceType?: string;
    view?: 'country' | 'group' | 'custom';
}

export interface CapacityPlanningListResponse {
    items: CapacityPlanningRecord[];
    total: number;
    page: number;
    pageSize: number;
    submittedByCountry: Record<string, number>;
    submittedByGroup: Record<string, number>;
    totalSubmitted: number;
    totalTarget: number;
}

export interface DeatomizedListItem {
    country: string;
    region: string;
    targetCount: number;
    submittedCount: number;
    internalReviewCount: number;
    deliveryProgress: number | null;
}

export interface DeatomizedListParams {
    week?: string;
    country?: string;
    groupMembers?: string;
    auditStatus?: string;
    sourceType?: string;
}

export interface DeatomizedListResponse {
    items: DeatomizedListItem[];
}

export interface CapacityDeatomizeDiagnosticItem {
    week: string;
    rawSubmitted: number;
    rawInternalReview: number;
    deatomizedSubmitted: number;
    deatomizedInternalReview: number;
    targetCount: number;
}

export interface CapacityDeatomizeDiagnosticResponse {
    items: CapacityDeatomizeDiagnosticItem[];
}

export interface CapacityPlanningFilterOptions {
    weeks: string[];
    countries: string[];
    groups: string[];
    auditStatuses: string[];
    sourceTypes: string[];
    defaultWeek?: string;
}

export interface CapacityPlanningSyncResponse {
    success: boolean;
    syncedCount: number;
    totalCount: number;
    submittedCount?: number;
    lastSyncedAt?: string;
    errors?: string[];
}

export interface RegistrySyncResponse {
    success: boolean;
    syncedCount: number;
    totalCount: number;
    syncedDate?: string;
    errors?: string[];
}

export interface RegistrySyncTaskResponse {
    taskId: string;
}

export interface RegistrySyncStatusResponse {
    status: 'running' | 'done' | 'failed';
    result?: RegistrySyncResponse;
    error?: string;
}

export interface RegistryDiagnosticIssue {
    severity: 'critical' | 'warning';
    category: 'data' | 'backfill' | 'sync' | 'infra';
    message: string;
}

export interface RegistryDiagnosticCheck {
    name: string;
    value: string | number;
    status: 'pass' | 'warn' | 'fail';
}

export interface RegistryDiagnosticReport {
    checkedAt: string;
    totalRecords: number;
    checks: RegistryDiagnosticCheck[];
    issues: RegistryDiagnosticIssue[];
    summary: { total: number; critical: number; warning: number; healthy: boolean };
    durationMs: number;
}

export interface RegistrySelfHealAction {
    action: string;
    detail: string;
    status: 'success' | 'failed';
}

export interface RegistrySelfHealReport {
    healedAt: string;
    before: RegistryDiagnosticReport;
    after: RegistryDiagnosticReport;
    actions: RegistrySelfHealAction[];
    healed: boolean;
    durationMs: number;
}

export interface RegistryListParams {
    page?: number;
    pageSize?: number;
    keyword?: string;
    keywordFields?: string[];
    country?: string;
    sortField?: string;
    sortOrder?: 'asc' | 'desc';
    filters?: Record<string, string>;
    dateFrom?: string;
    dateTo?: string;
    productionDateStart?: string;
    productionDateEnd?: string;
    productionDateEmpty?: boolean;
    rejectionReasonNotEmpty?: boolean;
}

export interface RegistryListSummary {
    totalCost: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    totalNua: number;
    totalPlayCount: number;
    totalPlay2s: number;
    totalPlayComplete: number;
    totalRunDays: number;
    totalArpu: number;
    cpa: number | null;
    ctr: number | null;
    play2sRate: number | null;
    playCompleteRate: number | null;
    dailyCostAvg: number | null;
}

export interface RegistryListResponse {
    items: CreativeAssetRegistryRecord[];
    total: number;
}

export interface FunctionGroupRecord {
    functionName: string;
    cost: number | null;
    clicks: number | null;
    impressions: number | null;
    ctr: number | null;
    cpa: number | null;
    play2s: number | null;
    playCount: number | null;
    playComplete: number | null;
    videoPlay2sRate: number | null;
    videoCompleteRate: number | null;
    avgVideoPlayDuration: number | null;
}

export interface RegistryFunctionListResponse {
    items: FunctionGroupRecord[];
}

export interface DimensionGroupRecord {
    dimensions: Record<string, string>;
    capacity: number;
    cost: number | null;
    arpu: number | null;
    clicks: number | null;
    impressions: number | null;
    ctr: number | null;
    cpa: number | null;
    conversionRate: number | null;
    conversions: number | null;
    play2s: number | null;
    playCount: number | null;
    playComplete: number | null;
    videoPlay2sRate: number | null;
    videoCompleteRate: number | null;
    avgVideoPlayDuration: number | null;
    moleculeDetail?: string;
}

export interface DimensionListParams {
    dimensions: string[];
    country?: string;
    sortField?: string;
    sortOrder?: 'asc' | 'desc';
    filters?: Record<string, string>;
    dateFrom?: string;
    dateTo?: string;
}

export interface DimensionListResponse {
    items: DimensionGroupRecord[];
}

export interface DimensionRecordsListParams {
    dimension: string;
    dimensionValue: string;
    country?: string;
    page?: number;
    pageSize?: number;
    filters?: Record<string, string>;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    sortColumns?: Array<{ field: string; order: 'asc' | 'desc' }>;
}

export interface DimensionRecordsListResponse {
    items: CreativeAssetRegistryRecord[];
    total: number;
}

export interface RegistryFilterOptions {
    country: string[];
    sourceTable: string[];
    director: string[];
    lateEditor: string[];
    functionName: string[];
    requirement: string[];
    painPoint: string[];
    molecule: string[];
    productionType: string[];
    hookType: string[];
    openingScene: string[];
    validElements: string[];
    validLocations: string[];
    scriptTagLevel1: string[];
    scriptTagLevel2: string[];
    newOrActive: string[];
    materialType: string[];
    productionStatus: string[];
    monitoringStatus: string[];
    week: string[];
    teamLeader: string[];
    auditStatus: string[];
}

// ---- Feishu Bot ----

export interface FeishuBotCondition {
    field: string;
    operator: string;
    value: string | number | string[];
    valueMode?: 'text' | 'formula';
}

export type FeishuBotDataSource =
    | 'creative_asset_registry'
    | 'creative_assets_export'
    | 'data_source'
    | 'ad_record'
    | 'material_sync';

export interface FeishuBotConditions {
    logic: 'and' | 'or';
    conditions: FeishuBotCondition[];
    dataSource?: FeishuBotDataSource;
}

export interface FeishuBotRecord {
    id: string;
    name: string;
    webhookUrl: string;
    conditions: FeishuBotConditions;
    messageTemplate: string;
    messageTitle: string;
    isActive: boolean;
    scheduleEnabled: boolean;
    scheduleTime: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateFeishuBotRequest {
    name: string;
    webhookUrl: string;
    conditions: FeishuBotConditions;
    messageTemplate: string;
    messageTitle?: string;
    scheduleEnabled?: boolean;
    scheduleTime?: string;
}

export interface UpdateFeishuBotRequest {
    name?: string;
    webhookUrl?: string;
    conditions?: FeishuBotConditions;
    messageTemplate?: string;
    messageTitle?: string;
    isActive?: boolean;
    scheduleEnabled?: boolean;
    scheduleTime?: string;
}

export interface FeishuBotListResponse {
    items: FeishuBotRecord[];
}

export interface FeishuBotSendResult {
    success: boolean;
    matchedCount: number;
    message: string;
    skipped?: boolean;
}


export interface RoiRecord {
    id: string;
    campaignNameId: string;
    campaignId: string;
    campaignName: string;
    country: string;
    advId: string;
    account: string;
    agent: string;
    date1: string;
    date2: string;
    roi: string;
    cost: string;
    gmv: string;
    assessment: string;
    newOrReactivate: string;
    direction: string;
    orientation: string;
    bid: string;
    conversions: string;
    optimization: string;
    cpa: string;
    creativeIds: string;
    materialIds: string;
    materialCost: string;
    materialCostRatio: string;
    materialGmv: string;
    materialRoi: string;
    materialTypePrime: string;
    ctr: string;
    play2sRate: string;
    playCompleteRate: string;
}

export interface RoiListParams {
    page?: number;
    pageSize?: number;
    keyword?: string;
    keywordFields?: string[];
    campaignId?: string;
    dateStart?: string;
    dateEnd?: string;
    countries?: string;
    materialTypes?: string;
    costMin?: string;
    roiMin?: string;
    sortField?: string;
    sortOrder?: 'asc' | 'desc';
    complianceStatus?: 'compliant' | 'warning' | 'non_compliant' | 'unknown';
}

export interface RoiCountriesResponse {
    countries: string[];
}

export interface RoiMaterialTypesResponse {
    materialTypes: string[];
}

export interface RoiListSummary {
    totalCost: number;
    totalGmv: number;
    roi: number | null;
    totalConversions: number;
    cpa: number | null;
    totalMaterialCost: number;
    totalMaterialGmv: number;
    materialRoi: number | null;
}

export interface RoiListResponse {
    items: RoiRecord[];
    total: number;
    summary?: RoiListSummary | null;
}

export interface RoiSyncResponse {
    success: boolean;
    totalRows: number;
    message?: string;
    status?: 'success' | 'skipped' | 'failed';
    reason?: string;
    syncDate?: string;
    syncTime?: string;
    lastSyncTime?: string;
    lastSyncCount?: number;
    feishuRowCount?: number;
    syncedCount?: number;
    durationMs?: number;
    error?: string;
    inserted?: number;
    skipped?: number;
    assessmentUpdated?: number;
    async?: boolean;
    taskId?: number;
}

export interface RoiUpdateTaskStatus {
    status: 'idle' | 'running' | 'success' | 'failed';
    taskId?: number;
    message?: string;
    inserted?: number;
    skipped?: number;
    assessmentUpdated?: number;
    totalRows?: number;
    startedAt?: string;
    finishedAt?: string;
}

export interface RoiSyncStatusResponse {
    latestSync: {
        syncDate: string;
        syncTime: string;
        rowCount: number;
        skipReason: string | null;
    } | null;
    todaySynced: boolean;
}

export interface RoiAgentOptionsResponse {
    agents: string[];
}

export interface RoiPivotParams {
    agent: string;
}

export interface RoiPivotRow {
    country: string;
    campaignName: string;
    date1: string;
    totalCost: number;
    totalGmv: number;
    totalRoi: number;
    avgAssessment: number | null;
}

export interface RoiPivotResponse {
    items: RoiPivotRow[];
    total: number;
}

export interface RoiCountryRoiParams {
    dateStart?: string;
    dateEnd?: string;
}

export interface RoiCountryRoiRow {
    country: string;
    date: string;
    totalCost: number;
    totalGmv: number;
    totalRoi: number;
    earlyCost: number;
    earlyGmv: number;
    earlyRoi: number;
    earlyAchievement: number | null;
    lateCost: number;
    lateGmv: number;
    lateRoi: number;
    lateAchievement: number | null;
    assessment: number | null;
    assessmentNew: number | null;
    assessmentForDate: number | null;
}

export interface RoiCountryPeriodSummary {
    country: string;
    earlyCost: number;
    earlyGmv: number;
    earlyRoi: number;
    earlyAchievement: number | null;
    lateCost: number;
    lateGmv: number;
    lateRoi: number;
    lateAchievement: number | null;
    newCost: number;
    newGmv: number;
    newRoi: number;
    newAchievement: number | null;
}

export interface RoiCountryRoiResponse {
    items: RoiCountryRoiRow[];
    total: number;
    periodSummary?: RoiCountryPeriodSummary[];
}

// ============ ROI 素材 ============

export interface RoiMaterialParams {
    keyword?: string;
    keywordFields?: string[];
    materialIds?: string;
    materialNames?: string;
    dateStart?: string;
    dateEnd?: string;
    page?: number;
    pageSize?: number;
    sortField?: string;
    sortOrder?: 'asc' | 'desc';
}

// ============ 投放国家收录 ============

export interface CountryRegistryRow {
    id: string;
    country: string;
    countryName: string;
    region: string;
    assessmentMetric: string;
    assessmentValue: string;
    assessmentValueNew: string;
    assessmentValueOct: string;
    status: '投放中' | '已暂停' | '未投放';
    createdAt: string;
    updatedAt: string;
}

export interface CountryRegistryListParams {
    page?: number;
    pageSize?: number;
    sortField?: string;
    sortOrder?: 'ascend' | 'descend';
}

export interface CountryRegistryListResponse {
    items: CountryRegistryRow[];
    total: number;
    page: number;
    pageSize: number;
}

export interface CountryRegistryCreateDto {
    country: string;
    countryName?: string;
    region: string;
    assessmentMetric?: string;
    assessmentValue?: string;
    assessmentValueNew?: string;
    assessmentValueOct?: string;
    status: '投放中' | '已暂停' | '未投放';
}

export interface CountryRegistrySyncResponse {
    synced: number;
    skipped: number;
    countries: string[];
}

export interface CountryRegistryVisibilityItem {
    id: string;
    country: string;
    countryName: string;
    region: string;
    status: '投放中' | '已暂停' | '未投放';
    showInReports: boolean;
}

export interface CountryRegistryVisibilityResponse {
    items: CountryRegistryVisibilityItem[];
}

export interface CountryRegistryVisibilityUpdateDto {
    showInReports: boolean;
}

export interface CountryRegistryUpdateDto {
    country?: string;
    countryName?: string;
    region?: string;
    assessmentMetric?: string;
    assessmentValue?: string;
    assessmentValueNew?: string;
    assessmentValueOct?: string;
    status?: '投放中' | '已暂停' | '未投放';
}

export interface CountryRegistryActiveResponse {
    countries: string[];
    pausedCountries: string[];
}

export interface CountryRegistryBatchImportItem {
    country: string;
    countryName: string;
    region: string;
    assessmentMetric: string;
    assessmentValue: string;
    status: '投放中' | '已暂停' | '未投放';
}

export interface CountryRegistryBatchImportDto {
    items: CountryRegistryBatchImportItem[];
}

export interface CountryRegistryBatchImportResponse {
    inserted: number;
    updated: number;
}

export interface CountryRegistryStatusChangeDto {
    status: string;
}

export interface CountryRegistryForceResetResponse {
    totalUsers: number;
    totalCountries: number;
    resetCount: number;
    skippedCount: number;
    dataSourceOnlyCountries: string[];
    dataSourceCountryCount: number;
    registryCountryCount: number;
}

export interface RoiMaterialRow {
    materialId: string;
    materialName: string;
    country: string;
    campaignId: string;
    campaignName: string;
    campaignCost: string;
    campaignCostRoi: string;
    cost: string;
    materialCostRoi: string;
    costRatio: string;
    gmv: string;
    materialGmv: string;
    roi: string;
    assessment: string;
    unmapped?: boolean;
}

export interface RoiMaterialSummary {
    totalCost: number;
    totalGmv: number;
    roi: number | null;
    totalMaterialGmv: number;
}

export interface RoiMaterialResponse {
    items: RoiMaterialRow[];
    total: number;
    unmapped?: {
        count: number;
        cost: string;
    };
    summary?: RoiMaterialSummary | null;
}

export interface RoiLatestDateResponse {
    latestDate: string;
}

// ============ ROI 日会 ============

export interface RoiDailyMeetingDataParams {
    agent: string;
    dateFrom?: string;
    dateTo?: string;
}

export interface RoiDailyMeetingCountryData {
    note: string;
    cost: number | null;
    gmv: number | null;
    roi: number | null;
    cpa: number | null;
    conversions: number | null;
}

export interface RoiDailyMeetingRow {
    date: string;
    isT1: boolean;
    data: Record<string, RoiDailyMeetingCountryData>;
}

export interface RoiDailyMeetingSummary {
    country: string;
    cost: number;
    gmv: number;
    roi: number;
    cpa: number;
}

export interface RoiDailyMeetingCountryMeta {
    country: string;
    targetRoi: string;
    color: string;
}

export interface RoiDailyMeetingDataResponse {
    agent: string;
    countries: string[];
    countryMeta: RoiDailyMeetingCountryMeta[];
    summary: RoiDailyMeetingSummary[];
    rows: RoiDailyMeetingRow[];
    blankRows: RoiDailyMeetingBlankRow[];
    overrides: Record<string, string>;
    dateRange: {
        availableFrom: string;
        availableTo: string;
        currentFrom: string;
        currentTo: string;
    };
}

export interface RoiDailyMeetingCellSaveBody {
    agent: string;
    value: string;
    formula?: string;
    style?: RoiDailyMeetingCellStyle;
}

export interface RoiDailyMeetingCellStyle {
    bg?: string;
    fc?: string;
    fs?: number;
    b?: number;
    i?: number;
    u?: number;
    ha?: string;
    va?: string;
    nf?: string;
}

export interface RoiSheetRowOpRequest {
    agent: string;
    atRow: number;
    count: number;
    position: 'above' | 'below';
}

export interface RoiSheetColOpRequest {
    agent: string;
    atCol: number;
    count: number;
    position: 'left' | 'right';
}

export interface RoiSheetDeleteRowsRequest {
    agent: string;
    fromRow: number;
    toRow: number;
}

export interface RoiSheetDeleteColsRequest {
    agent: string;
    fromCol: number;
    toCol: number;
}

export interface RoiSheetShiftCellsRequest {
    agent: string;
    r1: number;
    c1: number;
    r2: number;
    c2: number;
    direction: 'right' | 'down';
}

export interface RoiSheetOpResponse {
    ok: boolean;
}

export interface RoiCellHistoryItem {
    id: string;
    operation: string;
    oldValue: string;
    newValue: string;
    editor: string;
    updatedAt: string;
}

export interface RoiCellHistoryListResponse {
    items: RoiCellHistoryItem[];
}

export interface RoiCellComment {
    id: string;
    rowKey: string;
    colKey: string;
    content: string;
    author: string;
    createdAt: string;
}

export interface RoiCellCommentCreateRequest {
    agent: string;
    rowKey: string;
    colKey: string;
    content: string;
}

export interface RoiCellCommentsResponse {
    items: RoiCellComment[];
}

export interface RoiCellNoteItem {
    rowKey: string;
    colKey: string;
    content: string;
    author: string;
    updatedAt: string;
}

export interface RoiCellNoteSaveRequest {
    agent: string;
    rowKey: string;
    colKey: string;
    content: string;
}

export interface RoiCellNotesResponse {
    items: RoiCellNoteItem[];
}

export type RoiValidationType =
    | 'number-range'
    | 'dropdown'
    | 'text-length';

export interface RoiValidationRule {
    id: string;
    r1: number;
    c1: number;
    r2: number;
    c2: number;
    ruleType: RoiValidationType;
    params: string;
    createdBy: string;
    createdAt: string;
}

export interface RoiValidationCreateRequest {
    agent: string;
    r1: number;
    c1: number;
    r2: number;
    c2: number;
    ruleType: RoiValidationType;
    params: string;
}

export interface RoiValidationsResponse {
    items: RoiValidationRule[];
}

export interface RoiProtectedRange {
    id: string;
    r1: number;
    c1: number;
    r2: number;
    c2: number;
    createdBy: string;
    createdAt: string;
}

export interface RoiProtectedRangeCreateRequest {
    agent: string;
    r1: number;
    c1: number;
    c2: number;
    r2: number;
}

export interface RoiProtectedRangesResponse {
    items: RoiProtectedRange[];
}

export interface RoiDailyMeetingSheetCell {
    r: number;
    c: number;
    v: string;
    f?: string;
    style?: RoiDailyMeetingCellStyle;
}

export interface RoiSheetCreateRequest {
    title: string;
}

export interface RoiSheetCreateResponse {
    agent: string;
    sheet: RoiDailyMeetingSheetMeta;
}

export interface RoiMergeSetRequest {
    agent: string;
    r1: number;
    c1: number;
    r2: number;
    c2: number;
}

export type RoiCondFormatOp = 'gt' | 'lt' | 'eq' | 'between' | 'containsText';

export interface RoiCondFormatRule {
    id: string;
    r1: number;
    c1: number;
    r2: number;
    c2: number;
    op: RoiCondFormatOp;
    value1: string;
    value2?: string;
    bg?: string;
    fc?: string;
}

export interface RoiCondFormatCreateRequest {
    agent: string;
    r1: number;
    c1: number;
    r2: number;
    c2: number;
    op: RoiCondFormatOp;
    value1: string;
    value2?: string;
    bg?: string;
    fc?: string;
}

export interface RoiCondFormatsResponse {
    items: RoiCondFormatRule[];
}

export interface RoiDailyMeetingSheetMerge {
    sr: number;
    sc: number;
    er: number;
    ec: number;
}

export interface RoiDailyMeetingSheetMeta {
    agent: string;
    sheetId: string;
    title: string;
    frozenRows: number;
    frozenCols: number;
    rowCount: number;
    colCount: number;
    syncedAt: string;
}

export interface RoiDailyMeetingSheetsListResponse {
    sheets: RoiDailyMeetingSheetMeta[];
}

export interface RoiDailyMeetingSheetDataResponse {
    meta: RoiDailyMeetingSheetMeta;
    cells: RoiDailyMeetingSheetCell[];
    merges: RoiDailyMeetingSheetMerge[];
}

export interface RoiDailyMeetingCellSaveResponse {
    success: boolean;
}

export interface RoiDailyMeetingNoteBody {
    agent: string;
    country: string;
    date: string;
    note: string;
}

export interface RoiDailyMeetingT1RowBody {
    agent: string;
    country: string;
    date: string;
    cost: string;
    gmv: string;
    conversions: string;
}

export interface RoiDailyMeetingBlankRow {
    id: string;
    rowIndex: number;
    date: string;
    note: string;
}

export interface RoiDailyMeetingAddBlankRowsBody {
    agent: string;
    count: number;
}

export interface RoiDailyMeetingInsertBlankRowBody {
    agent: string;
    position: 'above' | 'below';
    referenceRowIndex: number;
}

export interface RoiDailyMeetingCellHistoryItem {
    id: string;
    agent: string;
    country: string;
    date: string;
    field: string;
    oldValue: string;
    newValue: string;
    updatedBy: string;
    updatedAt: string;
}

export interface RoiDailyMeetingCellHistoryBody {
    agent: string;
    country: string;
    date: string;
    field: string;
    oldValue: string;
    newValue: string;
}

export interface RoiDailyMeetingCellHistoryQuery {
    agent: string;
    country: string;
    date: string;
    field: string;
}

// ============ 素材分析 ============

export interface DimensionAnalysisItem {
    value: string;
    newCount: number;
    cost: number | null;
    cpa: number | null;
    arpu: number | null;
    ctr: number | null;
}

export interface MaterialFormulaItem {
    industry: string;
    materialType: string;
    sourceType: string;
    functionName: string;
    requirement: string;
    painPoint: string;
    useCase: string;
    displayText: string;
    newCount: number;
    cost: number | null;
    cpa: number | null;
    arpu: number | null;
    ctr: number | null;
}

export interface MaterialAnalysisOverview {
    newMaterialCount: number;
    totalCost: number | null;
    totalClicks: number | null;
    totalImpressions: number | null;
    ctr: number | null;
    arpu: number | null;
}

export interface MaterialVolumeMetrics {
    days: number;
    totalDailyCost: number;
    newDailyCost: number;
    newCount: number;
    newCostShare: number;
    perNewDailyCost: number;
    pSampleCount: number;
    pSampleWarning: boolean;
}

export interface MaterialAnalysisResponse {
    dateFrom: string;
    dateTo: string;
    countries: string[];
    displayScope: 'active' | 'new';
    overview: MaterialAnalysisOverview;
    volumeMetrics: MaterialVolumeMetrics;
    actualDailyCostByCountry: Record<string, number>;
    dimensions: Record<string, { label: string; items: DimensionAnalysisItem[] }>;
    formulas: MaterialFormulaItem[];
}

export interface CapacityPlanRequest {
    dateFrom: string;
    dateTo: string;
    countries: string[];
    totalDailyBudget: number;
    rNext?: number;
}

export interface CapacityPlanCountryResult {
    country: string;
    actualDailyCost: number;
    sharePercent: number;
    targetDailyBudget: number;
    newCostShare: number;
    perNewDailyCost: number;
    suggestedCount: number;
    sampleWarning: boolean;
}

export interface CapacityPlanFormula {
    rank: number;
    formula: MaterialFormulaItem;
    suggestedCount: number;
    sharePercent: number;
    historyNewCount: number;
    cpa: number | null;
    arpu: number | null;
    ctr: number | null;
    action: 'prioritize' | 'maintain' | 'cautious';
    bLayer: { productionType: string; hookType: string; openingScene: string };
    cLayer: { scriptTagLevel1: string; scriptTagLevel2: string; useCase: string };
}

export interface CapacityPlanningResponse {
    perCountry: CapacityPlanCountryResult[];
    formulas: CapacityPlanFormula[];
    totalSuggestedCount: number;
    formulaBasis: string;
}

export interface DashboardChartConfig {
    id: string;
    title: string;
    chartType: 'line' | 'bar' | 'pie' | 'scatter' | 'table';
    dataSource: string;
    xField?: string;
    yFields?: string[];
    groupField?: string;
    filters?: Record<string, unknown>;
    aggregation?: 'sum' | 'avg' | 'count';
    dateRangeField?: 'production_date' | 'consumption_date' | 'invest_date';
    dateStart?: string;
    dateEnd?: string;
}

export interface DashboardLayoutItem {
    chartId: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface DashboardConfig {
    id: string;
    name: string;
    description?: string;
    charts: DashboardChartConfig[];
    layout: DashboardLayoutItem[];
    isDefault: boolean;
}

export interface DashboardChartData {
    chartId: string;
    categories: string[];
    series: Array<{ name: string; data: number[] }>;
}

export interface DashboardDataResponse {
    data: DashboardChartData[];
}

export interface NavItemConfig {
    path: string;
    label: string;
}

export interface NavGroupConfig {
    key: string;
    label: string;
    items: NavItemConfig[];
}

export interface NavConfig {
    groups: NavGroupConfig[];
}

export interface NavConfigResponse {
    config: NavConfig | null;
    editable: boolean;
}

export interface TeamMemberMapping {
    id: string;
    memberName: string;
    memberId: string;
    codeName: string;
    startDate: string | null;
    endDate: string | null;
    dataSource: string;
    matchField: string;
    codePurpose: string;
    groupName: string | null;
    specialScopeMarker: string | null;
    country: string | null;
    materialType: string | null;
    teamLeader: string | null;
}

export interface TeamMemberMappingListResponse {
    items: TeamMemberMapping[];
    total: number;
}

export interface TeamMemberMappingCreateDto {
    memberName: string;
    memberId: string;
    codeName: string;
    startDate?: string | null;
    endDate?: string | null;
    dataSource: string;
    matchField: string;
    codePurpose: string;
    groupName?: string | null;
    specialScopeMarker?: string | null;
    country?: string | null;
    materialType?: string | null;
}

export interface TeamMemberMappingUpdateDto {
    memberName?: string;
    memberId?: string;
    codeName?: string;
    startDate?: string | null;
    endDate?: string | null;
    dataSource?: string;
    matchField?: string;
    codePurpose?: string;
    groupName?: string | null;
    specialScopeMarker?: string | null;
    country?: string | null;
    materialType?: string | null;
}

export interface MemberDataDetailItem {
    costDate: string;
    memberName: string;
    groupName: string;
    teamCost: number;
    performanceContribution: number;
}

export interface MemberDataDetailResponse {
    items: MemberDataDetailItem[];
    total: number;
}

export interface RollbackStatusResponse {
    running: boolean;
    success: boolean;
    count?: number;
    from?: string;
    to?: string;
    error?: string;
}

// ============ 素材同步 ============

export interface MaterialSyncEnrichRequest {
    materialNames: string[];
}

export interface MaterialSyncEnrichedItem {
    materialName: string;
    videoMaterialId: string | null;
    adGroupNames: string[];
    totalCost: number;
    xbCount: number;
    runDays: number;
}

export interface MaterialSyncEnrichResponse {
    items: MaterialSyncEnrichedItem[];
}

export interface MaterialSyncAttachment {
    name: string;
    tmpUrl: string;
}

export interface MaterialSyncRecord {
    id: string;
    source: string;
    materialType: string;
    country: string;
    syncDate: string;
    materialName: string;
    attachments: MaterialSyncAttachment[];
    dailyCost: number | null;
    materialForm: string;
    materialDirection: string;
    videoMaterialId: string | null;
    adGroupNames: string[];
    totalCost: number;
    xbCount: number;
    runDays: number;
    consumptionStatus: string | null;
}

export interface MaterialSyncListRequest {
    source?: string;
    keyword?: string;
    keywordFields?: string[];
    syncDateSort?: 'asc' | 'desc';
    xbCountMax?: number;
    page?: number;
    pageSize?: number;
}

export interface MaterialSyncListSummary {
    totalCost: number;
    totalXbCount: number;
    totalRunDays: number;
    dailyCostAvg: number | null;
}

export interface MaterialSyncListResponse {
    items: MaterialSyncRecord[];
    total: number;
    page: number;
    pageSize: number;
    summary: MaterialSyncListSummary | null;
}

export interface MaterialSyncTriggerResponse {
    success: boolean;
    syncedCount: number;
    totalCount: number;
    errors?: string[];
}

export interface RunoutRateRequest {
    materialType?: string;
    syncDateSort?: 'asc' | 'desc';
}

export interface RunoutRateItem {
    materialType: string;
    syncDate: string;
    totalCount: number;
    qualifiedCount: number;
    runoutRate: number | null;
}

export interface RunoutRateResponse {
    items: RunoutRateItem[];
}

export type MaterialSource = '自产' | 'TD' | '广大大';
export type ProgressStatus = 'DONE' | '制作中';

export interface RenovationRequestRow {
    id: string;
    optimizer: string;
    materialSource: MaterialSource;
    materialName: string;
    materialIdOrLink: string | null;
    country: string;
    videoAnalysis: string | null;
    requestDate: string | null;
    expectedDeliveryDate: string | null;
    expectedDeliveryCount: number | null;
    directorProgress: ProgressStatus | null;
    postProductionProgress: ProgressStatus | null;
    remarks: string | null;
    renovatedMaterialName: string | null;
    renovatedMaterialId: string | null;
    reportStatus: string | null;
    cost: number | null;
    cpa: number | null;
    ctr: number | null;
    play2sRate: number | null;
    playCompleteRate: number | null;
    renovatedCost: number | null;
    renovatedCtr: number | null;
    renovatedPlay2sRate: number | null;
    renovatedPlayCompleteRate: number | null;
    renovatedAdGroupNames: string | null;
    renovatedBaseCount: number | null;
    createdAt: string;
    updatedAt: string;
}

export interface RenovationRequestListResponse {
    items: RenovationRequestRow[];
    total: number;
    expectedDeliveryCountSum: number;
}

export interface CreateRenovationRequestDto {
    optimizer: string;
    materialSource: MaterialSource;
    materialName: string;
    materialIdOrLink?: string | null;
    country: string;
    videoAnalysis?: string | null;
    requestDate?: string | null;
    expectedDeliveryDate?: string | null;
    expectedDeliveryCount?: number | null;
    directorProgress?: ProgressStatus | null;
    postProductionProgress?: ProgressStatus | null;
    remarks?: string | null;
    renovatedMaterialName?: string | null;
    renovatedMaterialId?: string | null;
}

export interface UpdateRenovationRequestDto extends Partial<CreateRenovationRequestDto> {
}

export interface BatchDeleteRenovationRequestDto {
    ids: string[];
}

export interface BatchDeleteRenovationRequestResponse {
    deleted: number;
}

export interface BatchUpdateRenovationRequestDto {
    ids: string[];
    country?: string;
    expectedDeliveryDate?: string | null;
}

export interface BatchUpdateRenovationRequestResponse {
    updated: number;
}

export interface MigrateRequestDateItem {
    materialName: string;
    materialId?: string | null;
    requestDate: string;
}

export interface MigrateRequestDateResponse {
    matched: number;
    updated: number;
    total: number;
}

export interface BatchImportRenovationRequestDto {
    items: CreateRenovationRequestDto[];
}

export interface BatchImportRenovationRequestResponse {
    total: number;
    imported: number;
    conflicts: Array<{ country: string; existingRequestDate: string | null }>;
}

export interface RenovationDuplicateConflict {
    existingRequestDate: string | null;
    existingMaterialName: string | null;
}

export interface RenovationRequestCreateResponse extends RenovationRequestRow {
    duplicateConflict: RenovationDuplicateConflict | null;
}

export interface RenovationStatsItem {
    requestDate: string;
    weekLabel: string;
    country: string;
    expectedDeliveryCount: number;
}

export interface RenovationStatsResponse {
    items: RenovationStatsItem[];
}

export interface RenovationSyncDiagnosticResponse {
    headers: string[];
    columnFill: Array<{ column: string; header: string; filled: number }>;
    columnSamples: Array<{ column: string; samples: string[] }>;
    feishuDataRows: number;
    feishuValidRows: number;
    droppedEmptyName: Array<{ sheetRow: number; rawName: string }>;
    droppedMissingKeyFields: Array<{
        sheetRow: number;
        materialName: string;
        country: string;
        optimizer: string;
    }>;
    dbTotal: number;
    missingMaterials: string[];
    extraInDb: string[];
    fieldNulls: {
        materialIdEmpty: number;
        videoAnalysisEmpty: number;
        remarksEmpty: number;
        renovatedNameEmpty: number;
        renovatedIdEmpty: number;
    };
}

export interface MemberDailyCostRecord {
    recordDate: string;
    memberId: string;
    memberName: string;
    groupName: string;
    codeName: string;
    cost: number;
    rowCount: number;
    matchedBy: 'special_scope' | 'default' | 'unmatched';
}

export interface MemberDailyCostColumn {
    memberId: string;
    memberName: string;
    groupName: string;
    codeName: string;
}

export interface MemberDailyCostResponse {
    items: MemberDailyCostRecord[];
    members: MemberDailyCostColumn[];
    dates: string[];
}

export interface MemberDailyCostRecomputeResponse {
    recomputedDates: string[];
}

// ============ 用户偏好 ============

export interface UserPreference {
    key: string;
    value: string;
    updatedAt: string;
}

export interface UserPreferenceUpsertBody {
    key: string;
    value: string;
}

export interface UserPreferenceBatchResponse {
    items: UserPreference[];
}

// ============ 目标追踪权限管理 ============

export interface TabPermissionUser {
    userId: string;
    name: string;
}

export interface TabPermission {
    tabKey: string;
    tabName: string;
    groupName?: string;
    allowedUsers: TabPermissionUser[];
    allowedGroups: string[];
    updatedAt: string;
}

export interface TabPermissionListResponse {
    tabs: TabPermission[];
}

export interface UpdateTabPermissionBody {
    userIds: string[];
    groups: string[];
}

export interface MyTabAccessResponse {
    tabs: string[];
    memberGroups: string[] | null;
    progressGroups: string[] | null;
}

export interface ExportSourceInfo {
    tableName: string;
    label: string;
    fields: ExportSourceField[];
}

export interface ExportSourceField {
    columnName: string;
    label: string;
    type: 'text' | 'number' | 'date';
}

export interface ExportSyncRequest {
    targetType: 'bitable' | 'sheets';
    sourceTable: string;
    sourceFields: string[];
    filters: Record<string, string>;
    targetConfig: ExportTargetConfig;
    fieldMapping: Record<string, string>;
}

export interface ExportTargetConfig {
    pluginInstanceId?: string;
    spreadsheetToken?: string;
    sheetName?: string;
}

export interface ExportSyncResponse {
    addedCount: number;
    updatedCount: number;
    totalRecords: number;
    durationMs: number;
    targetType: string;
}

// ============ TikTok Auth ============

export type TokenRefreshStatus = 'ok' | 'pending' | 'failed';

export interface TokenStatusResponse {
    hasToken: boolean;
    hasRefreshToken: boolean;
    valid: boolean;
    longLived?: boolean;
    expiresInHours: number;
    lastRefreshedAt: string;
    refreshStatus: TokenRefreshStatus;
    alert?: string;
}

export interface AuthorizeRequest {
    redirectBase?: string;
}

export interface AuthorizeUrlResponse {
    authorizeUrl: string;
    proxiedAuthorizeUrl?: string;
    usedRedirectBase: string;
}

export interface TokenRefreshResponse {
    success: boolean;
    expiresInHours: number;
    error?: string;
}

export interface ConnectionTestResponse {
    success: boolean;
    advertiserName?: string;
    currency?: string;
    timeZone?: string;
    errorCode?: string;
    errorMsg?: string;
    networkOk?: boolean;
    networkError?: string;
    proxyMasked?: string;
}

export interface CredentialStatusResponse {
    configured: boolean;
    appIdMasked?: string;
    appSecretMasked?: string;
    missingKeys: string[];
    redirectBase?: string;
}

export interface AdvertiserSummary {
    advertiserId: string;
    advertiserName: string;
    currency: string;
    timeZone: string;
}

export interface AdvertiserListItem {
    advertiserId: string;
    advertiserName: string;
}

export interface AdvertiserListResponse {
    items: AdvertiserListItem[];
    syncPrefix: string;
    fallbackAdvertiserId?: string;
}

// ============ TikTok Pull Log ============

export interface PullLogItem {
    id: number;
    taskType: 'daily' | 'hourly' | 'backfill_play';
    triggerType: 'auto' | 'manual';
    status: 'running' | 'success' | 'failure';
    timeSlot: string | null;
    recordsInserted: number | null;
    datesPulled: string | null;
    errorMessage: string | null;
    attemptNumber: number | null;
    startedAt: string;
    finishedAt: string | null;
}

export interface PullLogListResponse {
    items: PullLogItem[];
    total: number;
}

// ============ TikTok Custom Report ============

export interface TikTokReportField {
    value: string;
    label: string;
    category: string;
    dataLevel: string[];
}

export interface TiktokCustomReportRequest {
    dimensions: string[];
    metrics: string[];
    startDate: string;
    endDate: string;
    dataLevel: string;
    advertiserIds?: string[];
    filtering?: Record<string, unknown>[];
}

export interface TiktokCustomReportResponse {
    columns: string[];
    rows: Record<string, unknown>[];
    totalRows: number;
}

export interface TiktokPaginationDiagAccount {
    advertiserId: string;
    advertiserName: string;
    firstPageRows: number;
    totalNumber: number;
    totalPage: number;
    sampleRows?: Record<string, unknown>[];
    errorCode?: number;
    errorMessage?: string;
}

export interface TiktokPaginationDiagResponse {
    dateStart: string;
    dateEnd: string;
    accounts: TiktokPaginationDiagAccount[];
    sumTotalNumber: number;
    sumFirstPageRows: number;
    accountsAtMaxPage: number;
    accountsWithShortPage: number;
}

// ============ Shooting Schedule ============

export interface ShootingScheduleRow {
    id?: string;
    weekLabel: string;
    weekStart: string;
    weekday: string;
    groupOrder: number;
    groupName: string;
    cameraPersons: string;
    countries: string;
    actualShootCount: number;
    project: string;
}

export interface ShootingScheduleSaveRequest {
    weekLabel: string;
    weekStart: string;
    rows: ShootingScheduleRow[];
}

export interface ShootingScheduleWeekItem {
    weekLabel: string;
    weekStart: string;
    hasData: boolean;
}

export interface ShootingScheduleCameraOption {
    name: string;
}

export interface ShootingScheduleCountryOption {
    countryCode: string;
    countryName: string;
}

// ============ 国家素材明细（双击国家消耗弹窗） ============

export interface CountryMaterialDetailRow {
    materialName: string;
    cost: number;
    ctr: number | null;
    play2sRate: number | null;
    playCompleteRate: number | null;
    conversionRate: number | null;
}

export interface CountryMaterialDetailResponse {
    items: CountryMaterialDetailRow[];
    total: number;
}

export interface CountryMaterialDetailRequest {
    date: string;
    country: string;
    group?: string[];
    timeSlot?: string;
}

// ============ 单元格编辑历史 ============

export interface CellHistoryTarget {
    entity: string;
    recordId: string;
    recordLabel?: string;
    fieldKey: string;
    fieldLabel: string;
}

export interface CellHistoryRecord {
    id: string;
    entity: string;
    recordId: string;
    recordLabel: string | null;
    fieldKey: string;
    fieldLabel: string;
    oldValue: string | null;
    newValue: string | null;
    editorId: string | null;
    editorName: string | null;
    editSource: string;
    createdAt: string;
}

export interface CellHistoryQuery {
    entity: string;
    recordId: string;
    fieldKey?: string;
}

export interface CellHistoryListResponse {
    items: CellHistoryRecord[];
}
