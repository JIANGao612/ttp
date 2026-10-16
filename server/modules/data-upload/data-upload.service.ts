/**
 * data-upload Service（脱离妙搭平台版本）
 *
 * 改造要点：
 *  - 移除平台专属依赖（FileService、DRIZZLE_DATABASE、TeamMemberMapping、CreativeAssets、CCT、Safety）
 *  - 上传入口改为 multipart：processBatchUploadBuffers / processHourlyUploadBuffers /
 *    processPairedUploadBuffers / processZeroCostUploadBuffers
 *  - enrichWithRegistryMatch 改为直查外部库 creative_asset_registry
 *  - 旧 downloadUrl 入口（processUpload 等）保留但抛错，引导使用 multipart
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ExternalDbService } from '../external-db/external-db.service';
import {
    dataSource,
    dataSourceDetail,
    dataBackup,
    uploadRecord,
} from '@server/database/app-schema';
import { eq, and, gte, lte, lt, inArray, sql, desc, count } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as XLSX from 'xlsx';
import { randomUUID } from 'crypto';
import { AFTERNOON_SLOT } from '@shared/time-slot-schedule';
import type {
    UploadResponse,
    UploadRecordListResponse,
    ClearRecentDataResponse,
    BatchUploadFileItem,
    BatchUploadResponse,
    BatchUploadFileResult,
    BatchPollResponse,
    UploadMode,
    UploadStatus,
    DiagDbActivityResponse,
    DiagDbBlockingPair,
    DiagDbActivitySession,
    BackupTableListResponse,
    BackupTableDataParams,
    BackupTableDataResponse,
    BackupTableRow,
    BackupTableInfo,
    CampaignMappingUploadResponse,
    MappingRefreshResponse,
} from '@shared/api.interface';
import {
    calcMaterialNameClean,
    calcCountry,
    calcMaterialDirection,
    calcBcDirection,
    calcMaterialType,
    calcPlacement,
    calcAgent,
    calcDateValue,
    calcMaterialCategory,
    calcNewOrActive,
    calcPlacer,
    calcBidType,
    calcSecondaryCategory,
    calcTertiaryCategory,
    calcMaterialDate,
    calcCreativeIdentityId,
    isValidCreativeIdentityId,
    resolveCreativeIdentityId,
} from './derived-fields';

// ============================================================
// 列定义（原样保留）
// ============================================================
const COLUMN_DEFS: { field: keyof ParsedRow; aliases: string[]; required: boolean }[] = [
    { field: 'seriesName', aliases: ['系列名称', '推广系列名称', 'Campaign name', 'campaign', '系列'], required: true },
    { field: 'recordDate', aliases: ['消耗时间', 'By Day', '日期', '按天'], required: true },
    { field: 'adGroupName', aliases: ['广告组名称', 'Ad group name', '广告组', 'Ad Group', 'Ad group', '广告组名'], required: false },
    { field: 'creativeName', aliases: ['Smart + 创意名称', '创意素材名称', 'Creative asset name', '创意名称', '创意', '视频'], required: false },
    { field: 'cost', aliases: ['消耗', 'Spend', 'cost', '花费'], required: true },
    { field: 'impressions', aliases: ['展示量', 'Impressions', '展示', '曝光'], required: true },
    { field: 'clicks', aliases: ['点击量', '点击量（目标页面）', 'Clicks (destination)', '点击'], required: true },
    { field: 'conversions', aliases: ['转化量', '付费量', 'Conversions', '付费量(网页)', '付费量（网页）', '付费', 'Conversion', '转化', 'Paid Conversions', '付费转化', 'Web Conversions', '网站转化', '转化数'], required: false },
    { field: 'cpaOriginal', aliases: ['平均转化成本', 'Cost per conversion'], required: false },
    { field: 'cpmOriginal', aliases: ['千次展示成本（CPM）', '千次展示成本 (CPM)', 'CPM'], required: false },
    { field: 'playCount', aliases: ['视频播放量', 'Video views', '播放量', 'video_play'], required: false },
    { field: 'play2s', aliases: ['视频播放 2 秒次数', '2-second video views', '视频播放2秒次数', '2s播放', 'play_2s'], required: false },
    { field: 'play5s', aliases: ['视频播放 6 秒次数', '6-second video views', '视频播放6秒次数', '6s播放', 'play_6s'], required: false },
    { field: 'playComplete', aliases: ['播放完成次数', 'Video views at 100%', '完播次数', 'play_complete'], required: false },
    { field: 'adGroupId', aliases: ['广告组ID', 'Ad group ID', 'ad_group_id'], required: false },
    { field: 'adName', aliases: ['广告名称', 'Ad name'], required: false },
    { field: 'adId', aliases: ['广告ID', 'Ad ID'], required: false },
    { field: 'creativeId', aliases: ['创意素材ID', 'Creative asset ID', '创意ID', 'creative_id'], required: false },
    { field: 'videoMaterialId', aliases: ['视频素材ID', 'Video material ID', 'video_material_id', 'vmid'], required: false },
    { field: 'videoCompleteRate', aliases: ['播放完成次数', '视频完播率', 'Video completion rate'], required: false },
    { field: 'avgVideoPlayDuration', aliases: ['平均视频播放时长', 'Average video play duration', '平均播放时长', 'avg_play_duration'], required: false },
    { field: 'country', aliases: ['国家', 'Country', 'country'], required: false },
    { field: 'materialType', aliases: ['素材类型', 'Material Type', 'material_type', 'materialType'], required: false },
    { field: 'placement', aliases: ['版位', 'Placement', 'placement'], required: false },
    { field: 'agent', aliases: ['代理', '代理商', 'Agent', 'agent'], required: false },
    { field: 'dateValue', aliases: ['日期值', 'Date Value', 'date_value', 'dateValue'], required: false },
    { field: 'materialCategory', aliases: ['素材大类', 'Material Category', 'material_category', 'materialCategory'], required: false },
    { field: 'newOrActive', aliases: ['人群类型', '新老素材', 'New/Active', 'new_or_active', 'newOrActive'], required: false },
    { field: 'cleanedMaterialName', aliases: ['清洗后素材名', 'Cleaned Material Name', 'cleaned_material_name', 'cleanedMaterialName', '视频名称', '视频', 'video', 'video_name'], required: false },
    { field: 'newUserActivated', aliases: ['新用户激活', 'New User Activated', 'new_user_activated', 'newUserActivated'], required: false },
    { field: 'placer', aliases: ['投放人', 'Placer', 'placer'], required: false },
    { field: 'bidType', aliases: ['出价类型', 'Bid Type', 'bid_type', 'bidType'], required: false },
    { field: 'materialDirection', aliases: ['素材方向', 'Material Direction', 'material_direction', 'materialDirection'], required: false },
    { field: 'bcDirection', aliases: ['B/C方向', 'BC Direction', 'bc_direction', 'bcDirection'], required: false },
    { field: 'materialDate', aliases: ['素材制作日期', 'Material Date', 'material_date', 'materialDate'], required: false },
    { field: 'secondaryCategory', aliases: ['二级分类', 'Secondary Category', 'secondary_category', 'secondaryCategory'], required: false },
    { field: 'tertiaryCategory', aliases: ['三级分类', 'Tertiary Category', 'tertiary_category', 'tertiaryCategory'], required: false },
    { field: 'creativeIdentityId', aliases: ['创意身份ID', 'Creative Identity ID', 'creative_identity_id', 'creativeIdentityId'], required: false },
    { field: 'campaignId', aliases: ['推广系列ID', 'Campaign ID', 'campaign_id', 'campaignId', '系列ID'], required: false },
];

type ColumnMap = Partial<Record<keyof ParsedRow, number>>;

function normalizeHeader(s: string): string {
    return s.replace(/^\uFEFF/, '').trim()
        .replace(/（/g, '(')
        .replace(/）/g, ')')
        .replace(/\s+/g, ' ');
}

const BLACKLIST_HEADER_KEYWORDS = [
    'currency', '币种', '货币', '币别',
    'video_material_thumbnail', '视频素材缩略图', '缩略图',
];

const CURRENCY_CODE_SET = new Set([
    'usd', 'eur', 'gbp', 'jpy', 'cny', 'rmb', 'aud', 'cad', 'chf', 'hkd',
    'sgd', 'krw', 'inr', 'brl', 'mxn', 'rub', 'zar', 'try', 'idr', 'thb',
    'vnd', 'php', 'myr', 'twd', 'sek', 'nok', 'dkk', 'pln', 'nzd', 'aed',
]);

function isBlacklistedHeader(lower: string): boolean {
    return BLACKLIST_HEADER_KEYWORDS.some((kw) => lower.includes(kw));
}

interface ParsedRow {
    seriesName: string;
    recordDate: string;
    adGroupName: string;
    creativeName: string;
    cost: string;
    impressions: number;
    clicks: number;
    conversions: number;
    cpaOriginal: string;
    cpmOriginal: string;
    playCount: number;
    play2s: number;
    play5s: number;
    playComplete: number;
    adGroupId: string;
    adName: string;
    adId: string;
    creativeId: string;
    videoMaterialId: string;
    videoCompleteRate: string;
    avgVideoPlayDuration: string;
    country: string;
    materialType: string;
    placement: string;
    agent: string;
    dateValue: string;
    materialCategory: string;
    newOrActive: string;
    cleanedMaterialName: string;
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
}

interface ComputedRecord extends ParsedRow {
    materialNameClean: string;
    audienceType: string;
    bcType: string;
}

type AdCacheSeed = Pick<
    ParsedRow,
    | 'adId'
    | 'adName'
    | 'seriesName'
    | 'adGroupName'
    | 'campaignId'
    | 'adGroupId'
    | 'videoMaterialId'
>;

function sqlVal(val: string | number | null | undefined): string {
    if (val === null || val === undefined || val === '') return 'NULL';
    if (typeof val === 'number') return isNaN(val) ? 'NULL' : String(val);
    const escaped = String(val).replace(/'/g, "''");
    return `'${escaped}'`;
}

function sqlTrunc(val: string | null | undefined, maxLen: number): string {
    return sqlVal(val != null ? String(val).substring(0, maxLen) : val);
}

@Injectable()
export class DataUploadService {
    private readonly logger = new Logger(DataUploadService.name);
    private _db: PostgresJsDatabase | null = null;
    private tableReady = false;
    private dbInitPromise: Promise<void> | null = null;
    private backfillsRunning = false;
    private uploadTimeoutTimers = new Map<string, ReturnType<typeof setTimeout>>();
    private lastStaleUploadReclaimAt = 0;
    private backfillTasks = new Map<string, {
        status: 'running' | 'done' | 'failed';
        startedAt: number;
        result?: { total: number; recleaned: number; rematched: number; updated: number; refreshed: number };
        error?: string;
    }>();

    /** 安全守卫（替代妙搭 SafetyService）：只打印日志 */
    private readonly safety = {
        guardWrite: (sqlPreview: string): void => {
            this.logger.warn(`[SafetyGuard] 即将执行写操作: ${sqlPreview}`);
        },
        guardDelete: (table: string, count?: number): void => {
            this.logger.warn(`[SafetyGuard] 即将删除 ${table}${count ? ` (${count} 行)` : ''}`);
        },
    };

    private static readonly UPLOAD_TIMEOUT_MS = 10 * 60 * 1000;
    private static readonly EXTERNAL_WRITE_LOCK_KEY = 7001;
    private static readonly BACKUP_TABLES = [
        'backup_t1', 'backup_t2', 'backup_t3', 'backup_t4',
        'backup_t5', 'backup_t6', 'backup_t7', 'backup_t8',
    ] as const;

    constructor(private readonly externalDb: ExternalDbService) {}

    // ============================================================
    // 数据库初始化
    // ============================================================

    private async ensureDb(): Promise<PostgresJsDatabase> {
        if (!this._db) {
            this._db = await this.externalDb.getDb();
        }
        if (!this.tableReady) {
            if (!this.dbInitPromise) {
                this.dbInitPromise = this.initTables().catch((err) => {
                    this.dbInitPromise = null;
                    throw err;
                });
            }
            await this.dbInitPromise;
        }
        return this._db!;
    }

    private async collectSchemaSnapshot(): Promise<{
        tables: Set<string>;
        columns: Map<string, Set<string>>;
        indexes: Set<string>;
    }> {
        const db = this._db!;
        const tables = new Set<string>();
        const columns = new Map<string, Set<string>>();
        const indexes = new Set<string>();

        const tableRows = await db.execute(sql`
      SELECT c.relname AS name FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = current_schema() AND c.relkind IN ('r', 'p')
    `) as unknown as Array<{ name: string }>;
        for (const row of tableRows) tables.add(row.name);

        const colRows = await db.execute(sql`
      SELECT c.relname AS table_name, a.attname AS column_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid
      WHERE n.nspname = current_schema() AND c.relkind IN ('r', 'p')
        AND a.attnum > 0 AND NOT a.attisdropped
    `) as unknown as Array<{ table_name: string; column_name: string }>;
        for (const row of colRows) {
            let set = columns.get(row.table_name);
            if (!set) { set = new Set<string>(); columns.set(row.table_name, set); }
            set.add(row.column_name);
        }

        const idxRows = await db.execute(sql`
      SELECT c.relname AS name FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = current_schema() AND c.relkind = 'i'
    `) as unknown as Array<{ name: string }>;
        for (const row of idxRows) indexes.add(row.name);

        return { tables, columns, indexes };
    }

    private async initTables(): Promise<void> {
        const db = this._db!;
        const snapshot = await this.collectSchemaSnapshot();
        const hasTable = (t: string): boolean => snapshot.tables.has(t);
        const hasColumn = (t: string, c: string): boolean => snapshot.columns.get(t)?.has(c) ?? false;
        const hasIndex = (i: string): boolean => snapshot.indexes.has(i);

        // ---------- 建 upload_record / ad_name_cache / campaign_attr_cache ----------
        if (!hasTable('ad_name_cache')) {
            await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ad_name_cache (
          ad_id text PRIMARY KEY, ad_name text, series_name text,
          ad_group_name text, campaign_id text, ad_group_id text, video_id text,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `);
        }
        if (!hasTable('campaign_attr_cache')) {
            await db.execute(sql`
        CREATE TABLE IF NOT EXISTS campaign_attr_cache (
          campaign_id text PRIMARY KEY, series_name text,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `);
        }

        // ---------- data_source 补列 ----------
        const dsColumns: Array<[string, string]> = [
            ['cleaned_material_name', 'VARCHAR(500)'], ['new_user_activated', 'integer DEFAULT 0'],
            ['placer', 'varchar(100)'], ['bid_type', 'varchar(50)'],
            ['material_direction', 'varchar(100)'], ['bc_direction', 'varchar(50)'],
            ['material_date', 'varchar(50)'], ['secondary_category', 'varchar(100)'],
            ['tertiary_category', 'varchar(100)'], ['creative_identity_id', 'varchar(200)'],
            ['campaign_id', 'varchar(200)'], ['time_slot', 'varchar(10)'],
            ['group_name', 'varchar(100)'], ['data_source', "varchar(50) NOT NULL DEFAULT 'promote'"],
        ];
        for (const [col, colType] of dsColumns) {
            if (!hasColumn('data_source', col)) {
                await db.execute(sql`ALTER TABLE data_source ADD COLUMN ${sql.raw(col)} ${sql.raw(colType)}`);
            }
        }
        if (!hasColumn('data_source_detail', 'data_source')) {
            await db.execute(sql`ALTER TABLE data_source_detail ADD COLUMN data_source varchar(50) NOT NULL DEFAULT 'promote'`);
        }
        const dsIndexes: Array<[string, string]> = [
            ['idx_data_source_cleaned_material_name', 'CREATE INDEX IF NOT EXISTS idx_data_source_cleaned_material_name ON data_source(cleaned_material_name)'],
            ['idx_data_source_campaign_id', 'CREATE INDEX IF NOT EXISTS idx_data_source_campaign_id ON data_source(campaign_id)'],
            ['idx_data_source_creative_identity_id', 'CREATE INDEX IF NOT EXISTS idx_data_source_creative_identity_id ON data_source(creative_identity_id)'],
        ];
        for (const [idxName, stmt] of dsIndexes) {
            if (!hasIndex(idxName)) await db.execute(sql.raw(stmt));
        }
        for (const dropCol of ['account_name', 'account_id', 'series_id']) {
            if (hasColumn('data_source', dropCol)) {
                await db.execute(sql`ALTER TABLE data_source DROP COLUMN ${sql.raw(dropCol)}`);
            }
        }

        // ---------- 备份表 ----------
        const backupCols: Array<[string, string]> = [
            ['cleaned_material_name', 'VARCHAR(500)'], ['new_user_activated', 'integer DEFAULT 0'],
            ['placer', 'varchar(100)'], ['bid_type', 'varchar(50)'],
            ['material_direction', 'varchar(100)'], ['bc_direction', 'varchar(50)'],
            ['material_date', 'varchar(50)'], ['secondary_category', 'varchar(100)'],
            ['tertiary_category', 'varchar(100)'], ['creative_identity_id', 'varchar(200)'],
            ['campaign_id', 'varchar(200)'], ['time_slot', 'varchar(10)'],
            ['data_source', "varchar(50) NOT NULL DEFAULT 'promote'"],
        ];
        for (const t of DataUploadService.BACKUP_TABLES) {
            if (!hasTable(t)) {
                await db.execute(sql`CREATE TABLE IF NOT EXISTS ${sql.raw(t)} (LIKE data_source INCLUDING DEFAULTS)`);
            }
            if (!hasIndex(`idx_${t}_date`)) {
                await db.execute(sql`CREATE INDEX IF NOT EXISTS ${sql.raw(`idx_${t}_date`)} ON ${sql.raw(t)}(date_value)`);
            }
            for (const [col, colType] of backupCols) {
                if (!hasColumn(t, col)) {
                    await db.execute(sql`ALTER TABLE ${sql.raw(t)} ADD COLUMN ${sql.raw(col)} ${sql.raw(colType)}`);
                }
            }
        }

        // ---------- hourly_data_record ----------
        if (!hasTable('hourly_data_record')) {
            await db.execute(sql`
        CREATE TABLE IF NOT EXISTS hourly_data_record (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          record_date VARCHAR(20) NOT NULL, time_slot VARCHAR(10) NOT NULL,
          total_cost NUMERIC DEFAULT 0, cost_change_rate NUMERIC,
          country_costs TEXT, country_bid_ratios TEXT,
          _created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
        }
        if (!hasIndex('idx_hourly_record_unique')) {
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_hourly_record_unique ON hourly_data_record(record_date, time_slot)`);
        }
        if (!hasColumn('hourly_data_record', 'country_bid_ratios')) {
            await db.execute(sql`ALTER TABLE hourly_data_record ADD COLUMN country_bid_ratios TEXT`);
        }
        if (!hasColumn('hourly_data_record', 'country_conversions')) {
            await db.execute(sql`ALTER TABLE hourly_data_record ADD COLUMN country_conversions TEXT`);
        }

        // ---------- upload_record 补列 ----------
        if (!hasColumn('upload_record', 'result_payload')) {
            await db.execute(sql`ALTER TABLE upload_record ADD COLUMN result_payload TEXT`);
        }
        if (!hasColumn('upload_record', 'batch_key')) {
            await db.execute(sql`ALTER TABLE upload_record ADD COLUMN batch_key TEXT`);
        }

        // ---------- promote_daily_baseline ----------
        if (!hasTable('promote_daily_baseline')) {
            await db.execute(sql`
        CREATE TABLE IF NOT EXISTS promote_daily_baseline (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          record_date VARCHAR(20) NOT NULL, country VARCHAR(100) NOT NULL DEFAULT 'TOTAL',
          total_cost NUMERIC DEFAULT 0, total_conversions INTEGER DEFAULT 0,
          laxin_cost NUMERIC DEFAULT 0, laxin_conversions INTEGER DEFAULT 0,
          lahuo_cost NUMERIC DEFAULT 0, lahuo_conversions INTEGER DEFAULT 0,
          lishi_cost NUMERIC DEFAULT 0, lishi_conversions INTEGER DEFAULT 0,
          _created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
        }
        const baselineColumns: Array<[string, string]> = [
            ['laxin_cost', 'NUMERIC DEFAULT 0'], ['laxin_conversions', 'INTEGER DEFAULT 0'],
            ['lahuo_cost', 'NUMERIC DEFAULT 0'], ['lahuo_conversions', 'INTEGER DEFAULT 0'],
            ['lishi_cost', 'NUMERIC DEFAULT 0'], ['lishi_conversions', 'INTEGER DEFAULT 0'],
        ];
        for (const [col, colType] of baselineColumns) {
            if (!hasColumn('promote_daily_baseline', col)) {
                await db.execute(sql`ALTER TABLE promote_daily_baseline ADD COLUMN ${sql.raw(col)} ${sql.raw(colType)}`);
            }
        }
        if (!hasIndex('idx_promote_daily_baseline_unique')) {
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_promote_daily_baseline_unique ON promote_daily_baseline(record_date, country)`);
        }

        this.tableReady = true;
        await this.terminateStaleSessions(db);
        void this.runBackfillsOnce();
    }

    private async terminateStaleSessions(db: PostgresJsDatabase): Promise<void> {
        try {
            const rows = (await db.execute(sql`
        SELECT pg_terminate_backend(pid) AS terminated FROM pg_stat_activity
        WHERE datname = current_database() AND pid <> pg_backend_pid()
          AND (
            (state = 'idle in transaction' AND xact_start IS NOT NULL
              AND extract(epoch FROM now() - xact_start) > 120)
            OR (state = 'idle' AND query ILIKE '%pg_try_advisory_lock%'
              AND query_start IS NOT NULL AND extract(epoch FROM now() - query_start) > 300)
          )
      `)) as unknown as Array<{ terminated: boolean }>;
            const cnt = rows.filter((r) => r.terminated).length;
            if (cnt > 0) this.logger.warn(`Terminated ${cnt} stale external-db sessions`);
        } catch (err) {
            this.logger.warn(`terminateStaleSessions failed (ignored): ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    // ============================================================
    // Backfill 调度（第 1 批空跑；第 3 批实现内审表相关）
    // ============================================================

    private async runBackfillsOnce(): Promise<void> {
        if (this.backfillsRunning) return;
        this.backfillsRunning = true;
        try {
            // 第 1 批不跑历史 backfill（第 3 批实现）
        } catch (err) {
            this.logger.error(`runBackfillsOnce failed: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            this.backfillsRunning = false;
        }
    }

    async restartBackfills(): Promise<{ started: boolean }> {
        return { started: false };
    }

    async diagDbActivity(): Promise<DiagDbActivityResponse> {
        const db = await this.ensureDb();
        const sessionRows = await db.execute(sql`
      SELECT pid, usename, state, wait_event_type, wait_event,
        extract(epoch FROM now() - xact_start)::int AS xact_secs,
        extract(epoch FROM now() - query_start)::int AS query_secs,
        left(query, 300) AS query
      FROM pg_stat_activity
      WHERE datname = current_database() AND pid <> pg_backend_pid()
      ORDER BY xact_start NULLS LAST, query_start NULLS LAST
    `) as unknown as Array<{
            pid: string; usename: string | null; state: string | null;
            wait_event_type: string | null; wait_event: string | null;
            xact_secs: number | null; query_secs: number | null; query: string;
        }>;
        const sessions: DiagDbActivitySession[] = sessionRows.map((r) => ({
            pid: Number(r.pid), usename: r.usename ?? '', state: r.state ?? '',
            waitEventType: r.wait_event_type ?? '', waitEvent: r.wait_event ?? '',
            xactSecs: r.xact_secs, querySecs: r.query_secs, query: r.query ?? '',
        }));
        const blockRows = await db.execute(sql`
      SELECT blocked.pid AS blocked_pid, blocking.pid AS blocking_pid,
        blocking.state AS blocking_state,
        extract(epoch FROM now() - blocking.xact_start)::int AS blocking_xact_secs,
        left(blocking.query, 300) AS blocking_query
      FROM pg_stat_activity blocked
      JOIN LATERAL unnest(pg_blocking_pids(blocked.pid)) AS bp(pid) ON true
      JOIN pg_stat_activity blocking ON blocking.pid = bp.pid
      WHERE blocked.pid <> pg_backend_pid()
    `) as unknown as Array<{
            blocked_pid: string; blocking_pid: string; blocking_state: string | null;
            blocking_xact_secs: number | null; blocking_query: string;
        }>;
        const blocking: DiagDbBlockingPair[] = blockRows.map((r) => ({
            blockedPid: Number(r.blocked_pid), blockingPid: Number(r.blocking_pid),
            blockingState: r.blocking_state ?? '', blockingXactSecs: r.blocking_xact_secs,
            blockingQuery: r.blocking_query ?? '',
        }));
        return { sessions, blocking };
    }

    async hasRecentDataForUpload(): Promise<{ hasData: boolean; dateStart: string; dateEnd: string }> {
        const db = await this.ensureDb();
        const today = new Date();
        const end = new Date(today); end.setDate(end.getDate() - 1);
        const start = new Date(today); start.setDate(start.getDate() - 8);
        const dateStart = start.toISOString().slice(0, 10);
        const dateEnd = end.toISOString().slice(0, 10);
        const existing = await db
            .select({ id: dataSource.id })
            .from(dataSource)
            .where(and(gte(dataSource.dateValue, dateStart), lte(dataSource.dateValue, dateEnd)))
            .limit(1);
        return { hasData: existing.length > 0, dateStart, dateEnd };
    }

    startBackfillIdentityId(): { taskId: string } {
        const taskId = randomUUID();
        this.backfillTasks.set(taskId, { status: 'done', startedAt: Date.now() });
        return { taskId };
    }

    getBackfillStatus(taskId: string): {
        status: string; startedAt: number;
        result?: { total: number; recleaned: number; rematched: number; updated: number; refreshed: number };
        error?: string;
    } | null {
        const task = this.backfillTasks.get(taskId);
        if (!task) return null;
        return { ...task };
    }

    // ============================================================
    // ⭐ 内审表匹配（直查外部库 creative_asset_registry）
    // ============================================================

    /**
     * 上传时匹配「创意身份ID」：
     *   1. 只处理身份ID为空的记录
     *   2. 按 materialNameClean 批量查外部库 creative_asset_registry.final_name
     *   3. 命中则把 identity_card_id 赋给记录
     */
    private async enrichWithRegistryMatch(records: ComputedRecord[]): Promise<void> {
        const needMatch = records.filter(
            (r) => (!r.creativeIdentityId || r.creativeIdentityId === '未命名' || r.creativeIdentityId === '未匹配') && r.materialNameClean,
        );
        if (needMatch.length === 0) return;

        const db = await this.ensureDb();
        const nameToRecords = new Map<string, ComputedRecord[]>();
        for (const r of needMatch) {
            const name = r.materialNameClean.trim();
            if (!name) continue;
            if (!nameToRecords.has(name)) nameToRecords.set(name, []);
            nameToRecords.get(name)!.push(r);
        }

        const names = [...nameToRecords.keys()];
        const nameToIdentityId = new Map<string, string>();

        const NAME_BATCH = 500;
        for (let i = 0; i < names.length; i += NAME_BATCH) {
            const batch = names.slice(i, i + NAME_BATCH);
            const placeholders = sql.join(batch.map((n) => sql`${n}`), sql`, `);
            const rows = (await db.execute(sql`
        SELECT DISTINCT ON (final_name) final_name, identity_card_id
        FROM creative_asset_registry
        WHERE final_name IN (${placeholders})
          AND identity_card_id IS NOT NULL AND identity_card_id != ''
        ORDER BY final_name, _updated_at DESC NULLS LAST
      `)) as unknown as Array<{ final_name: string; identity_card_id: string }>;

            for (const row of rows) {
                if (row.final_name && row.identity_card_id && !nameToIdentityId.has(row.final_name)) {
                    nameToIdentityId.set(row.final_name, row.identity_card_id);
                }
            }
        }

        let matched = 0;
        for (const [name, recs] of nameToRecords) {
            const id = nameToIdentityId.get(name);
            if (id && isValidCreativeIdentityId(id)) {
                for (const r of recs) {
                    r.creativeIdentityId = id;
                    matched++;
                }
            }
        }
        if (matched > 0) {
            this.logger.log(`内审表匹配: ${matched}/${needMatch.length} 条通过 final_name 匹配到身份ID`);
        }
    }

    // ============================================================
    // ⭐ 上传主入口（multipart）
    // ============================================================

    /**
     * 接收 multipart 上传的 Buffer[]，代替原「从 Dataloom 下载」的流程
     */
    async processBatchUploadBuffers(
        files: { fileName: string; buffer: Buffer }[],
        uploadMode: UploadMode,
        baselineDate?: string,
    ): Promise<BatchUploadResponse> {
        if (uploadMode === 'paired') {
            return this.processPairedUploadBuffers(files, baselineDate);
        }
        if (uploadMode === 'zero_cost') {
            return this.processZeroCostUploadBuffers(files);
        }
        return this.processHourlyUploadBuffers(files, uploadMode, baselineDate);
    }

    /** 时报上传（12/16/22/24 四档）—— multipart 版本 */
    private async processHourlyUploadBuffers(
        files: { fileName: string; buffer: Buffer }[],
        uploadMode: UploadMode,
        _baselineDate?: string,
    ): Promise<BatchUploadResponse> {
        const db = await this.ensureDb();
        const fileNames = files.map((f) => f.fileName).join(', ');
        const modeLabel = this.getModeLabel(uploadMode);
        const fullFileName = `${modeLabel}: ${fileNames}`;

        const [record] = await db
            .insert(uploadRecord)
            .values({
                fileName: fullFileName.length > 500 ? `${fullFileName.slice(0, 497)}...` : fullFileName,
                filePath: fileNames,
                status: 'processing',
                batchKey: fileNames,
            })
            .returning({ id: uploadRecord.id });
        this.armUploadTimeout(record.id);

        try {
            const fileResults: BatchUploadFileResult[] = [];
            const allRecords: ComputedRecord[] = [];
            const allErrors: string[] = [];
            let totalRows = 0;

            await this.updateBatchProgress(record.id, 10, '解析文件');

            for (const file of files) {
                try {
                    const { headers, dataRows, headerOffset } = this.parseFile(file.buffer, file.fileName);
                    const colMap = this.buildColumnMap(headers);
                    if (Object.keys(colMap).length === 0) {
                        throw new BadRequestException(`文件 ${file.fileName} 无可识别的数据字段，请检查上传模板`);
                    }
                    this.validateColumnMap(colMap);
                    const { rows: cleanedRows, errors: fileErrors } = this.cleanData(dataRows, colMap, headerOffset);
                    const records = this.computeRecords(cleanedRows);

                    fileResults.push({
                        fileName: file.fileName, success: true,
                        totalRows: dataRows.length, validRows: records.length,
                        errors: fileErrors.length > 0 ? fileErrors : undefined,
                    });
                    allRecords.push(...records);
                    totalRows += dataRows.length;
                    if (fileErrors.length > 0) allErrors.push(...fileErrors);
                } catch (fileErr: unknown) {
                    const msg = fileErr instanceof Error ? fileErr.message : String(fileErr);
                    this.logger.error(`文件处理失败: ${file.fileName} - ${msg}`);
                    fileResults.push({
                        fileName: file.fileName, success: false,
                        totalRows: 0, validRows: 0, errorMsg: msg,
                    });
                }
            }

            if (allRecords.length === 0) {
                throw new BadRequestException('所有文件清洗后均无有效数据行');
            }

            const dateRange = await this.withExternalDbWriteLock('时报上传', async () => {
                await this.updateBatchProgress(record.id, 40, '匹配资产');
                await this.enrichWithRegistryMatch(allRecords);
                const dr = this.getDateRange(allRecords);
                await this.updateBatchProgress(record.id, 60, '写入数据库');

                const afternoonSlot: string = AFTERNOON_SLOT;
                if (uploadMode === 'hourly_noon') {
                    await this.deleteHourlyData(dr, '12:00');
                    await this.insertData(allRecords, '12:00');
                    await this.writeHourlyRecord(allRecords, '12:00');
                } else if (uploadMode === 'hourly_first') {
                    await this.deleteHourlyData(dr, afternoonSlot);
                    await this.insertData(allRecords, afternoonSlot);
                    await this.writeHourlyRecord(allRecords, afternoonSlot);
                } else if (uploadMode === 'hourly_second') {
                    await this.deleteHourlyData(dr, '22:00');
                    await this.insertData(allRecords, '22:00');
                    await this.writeHourlyRecord(allRecords, '22:00');
                } else if (uploadMode === 'hourly_third') {
                    await this.deleteHourlyData(dr, '24:00');
                    await this.insertData(allRecords, '24:00');
                    await this.writeHourlyRecord(allRecords, '24:00');
                } else {
                    await this.insertData(allRecords);
                }
                return dr;
            });

            const response: BatchUploadResponse = {
                success: true, totalRows, validRows: allRecords.length,
                dataDateStart: dateRange.start, dataDateEnd: dateRange.end,
                fileResults, errors: allErrors.length > 0 ? allErrors : undefined,
            };

            await this.updateUploadRecord(record.id, 'success', {
                totalRows, validRows: allRecords.length,
                dataDateStart: dateRange.start, dataDateEnd: dateRange.end,
                resultPayload: JSON.stringify(response),
            });
            return response;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            await this.updateUploadRecord(record.id, 'failed', { errorMessage: errorMsg });
            throw error;
        }
    }

    /** Paired 上传（日报 + 映射）—— multipart 版本 */
    private async processPairedUploadBuffers(
        files: { fileName: string; buffer: Buffer }[],
        baselineDate?: string,
    ): Promise<BatchUploadResponse> {
        if (files.length !== 2) {
            throw new BadRequestException('Paired 模式需要同时上传 2 个文件：Promote 日报 + 映射文件');
        }

        const db = await this.ensureDb();
        const fileNames = files.map((f) => f.fileName).join(', ');
        const fullFileName = `Paired: ${fileNames}`;

        const [record] = await db
            .insert(uploadRecord)
            .values({
                fileName: fullFileName.length > 500 ? `${fullFileName.slice(0, 497)}...` : fullFileName,
                filePath: fileNames,
                status: 'processing',
                batchKey: fileNames,
            })
            .returning({ id: uploadRecord.id });
        this.armUploadTimeout(record.id);

        try {
            const parsedFiles: { fileName: string; headers: string[]; dataRows: unknown[][]; headerOffset: number; colMap: ColumnMap }[] = [];
            for (const file of files) {
                const { headers, dataRows, headerOffset } = this.parseFile(file.buffer, file.fileName);
                const colMap = this.buildColumnMap(headers);
                if (Object.keys(colMap).length === 0) {
                    throw new BadRequestException(`文件 ${file.fileName} 无可识别的数据字段`);
                }
                parsedFiles.push({ fileName: file.fileName, headers, dataRows, headerOffset, colMap });
            }

            const dailyFile = parsedFiles.find((f) => f.colMap.recordDate !== undefined);
            const mappingFile = parsedFiles.find((f) => f.colMap.seriesName !== undefined);
            if (!dailyFile) throw new BadRequestException('未找到日报文件（缺少"消耗时间/日期"列）');
            if (!mappingFile) throw new BadRequestException('未找到映射文件（缺少"推广系列名称"列）');

            const dailyRequired: (keyof ParsedRow)[] = ['recordDate', 'cost', 'impressions', 'clicks', 'creativeId'];
            const dailyMissing = dailyRequired.filter((f) => dailyFile.colMap[f] === undefined);
            if (dailyMissing.length > 0) {
                throw new BadRequestException(`日报文件缺少必填列: ${dailyMissing.join(', ')}`);
            }

            const { rows: dailyRawRows, errors: dailyErrors } = this.cleanData(
                dailyFile.dataRows, dailyFile.colMap, dailyFile.headerOffset, { preMerge: true },
            );
            const { rows: mappingRows } = this.cleanData(
                mappingFile.dataRows, mappingFile.colMap, mappingFile.headerOffset, { mappingFile: true },
            );

            const mappingLookup = new Map<string, Partial<ParsedRow>>();
            for (const row of mappingRows) {
                if (row.creativeId) {
                    mappingLookup.set(row.creativeId, {
                        seriesName: row.seriesName, campaignId: row.campaignId,
                        adGroupName: row.adGroupName, adGroupId: row.adGroupId,
                        creativeName: row.creativeName,
                    });
                }
            }

            await this.seedCampaignAttrCache(mappingRows);
            await this.seedAdNameCacheFromMapping(mappingRows);

            const mergedRows: ParsedRow[] = [];
            let unmatchedCount = 0;
            let unmatchedCost = 0;
            const unmatchedByCreativeId = new Map<string, number>();

            for (const daily of dailyRawRows) {
                const mapping = mappingLookup.get(daily.creativeId);
                if (mapping) {
                    mergedRows.push({
                        ...daily,
                        seriesName: mapping.seriesName || daily.seriesName,
                        campaignId: mapping.campaignId || daily.campaignId,
                        adGroupName: mapping.adGroupName || daily.adGroupName,
                        adGroupId: mapping.adGroupId || daily.adGroupId,
                        creativeName: mapping.creativeName || daily.creativeName,
                    });
                } else {
                    mergedRows.push(daily);
                    unmatchedCount++;
                    const costNum = Number(daily.cost ?? 0);
                    unmatchedCost += costNum;
                    if (daily.creativeId) {
                        const prev = unmatchedByCreativeId.get(daily.creativeId) ?? 0;
                        unmatchedByCreativeId.set(daily.creativeId, prev + costNum);
                    }
                }
            }

            const records = this.computeRecords(mergedRows);
            if (records.length === 0) throw new BadRequestException('Paired 合并后无记录');

            const allErrors: string[] = [...dailyErrors];
            if (unmatchedCount > 0) {
                allErrors.push(`${unmatchedCount} 行日报数据未匹配到映射记录，波及消耗 ¥${unmatchedCost.toFixed(2)}`);
            }

            const dateRange = await this.withExternalDbWriteLock('Paired 上传', async () => {
                await this.updateBatchProgress(record.id, 40, '匹配资产');
                await this.enrichWithRegistryMatch(records);
                const dr = this.getDateRange(records);
                await this.updateBatchProgress(record.id, 60, '写入数据库');
                await this.insertData(records);
                await this.writeDailyBaseline(records, dr, baselineDate);
                await this.backfillAdIdFromCreative(dr.start, dr.end, true);
                return dr;
            });

            const unmatchedDetails = [...unmatchedByCreativeId.entries()]
                .map(([creativeId, cost]) => ({ creativeId, cost }))
                .sort((a, b) => b.cost - a.cost);

            const response: BatchUploadResponse = {
                success: true, totalRows: dailyFile.dataRows.length, validRows: records.length,
                dataDateStart: dateRange.start, dataDateEnd: dateRange.end,
                fileResults: [
                    { fileName: dailyFile.fileName, success: true, totalRows: dailyFile.dataRows.length, validRows: records.length },
                    { fileName: mappingFile.fileName, success: true, totalRows: mappingFile.dataRows.length, validRows: mappingLookup.size },
                ],
                errors: allErrors.length > 0 ? allErrors : undefined,
                unmatchedCost: unmatchedCount > 0 ? unmatchedCost : undefined,
                unmatchedDetails: unmatchedDetails.length > 0 ? unmatchedDetails : undefined,
            };

            await this.updateUploadRecord(record.id, 'success', {
                totalRows: dailyFile.dataRows.length, validRows: records.length,
                dataDateStart: dateRange.start, dataDateEnd: dateRange.end,
                resultPayload: JSON.stringify(response),
            });

            return response;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            await this.updateUploadRecord(record.id, 'failed', { errorMessage: errorMsg });
            throw error;
        }
    }

    /** 0 耗素材上传（第 3 批实现） */
    private async processZeroCostUploadBuffers(
        _files: { fileName: string; buffer: Buffer }[],
    ): Promise<BatchUploadResponse> {
        throw new BadRequestException('0耗素材上传将在第 3 批实现，请暂用其他上传模式');
    }

    // ============================================================
    // 旧入口（用 downloadUrl）：全部抛错，引导改用 multipart
    // ============================================================

    async processUpload(_fileName: string, _downloadUrl: string): Promise<UploadResponse> {
        throw new BadRequestException('请使用 /api/data-upload/upload-files 端点（multipart/form-data）上传文件');
    }

    async processBatchUpload(_files: BatchUploadFileItem[], _uploadMode?: UploadMode, _baselineDate?: string): Promise<BatchUploadResponse> {
        throw new BadRequestException('请使用 /api/data-upload/upload-files 端点（multipart/form-data）上传文件');
    }

    // ============================================================
    // processBuffer：本地直接处理 Buffer（用于调试）
    // ============================================================

    async processBuffer(fileName: string, buffer: Buffer): Promise<UploadResponse> {
        await this.ensureDb();
        const { headers, dataRows, headerOffset } = this.parseFile(buffer, fileName);
        const colMap = this.buildColumnMap(headers);
        if (Object.keys(colMap).length === 0) throw new BadRequestException('无可识别的数据字段');
        this.validateColumnMap(colMap);

        const totalRows = dataRows.length;
        const { rows: cleanedRows } = this.cleanData(dataRows, colMap, headerOffset);
        const records = this.computeRecords(cleanedRows);
        if (records.length === 0) throw new BadRequestException('清洗后无有效数据行');

        const dateRange = await this.withExternalDbWriteLock('本地导入', async () => {
            await this.enrichWithRegistryMatch(records);
            const dr = this.getDateRange(records);
            await this.insertData(records);
            await this.writeDailyBaseline(records, dr);
            return dr;
        });

        return {
            success: true, totalRows, validRows: records.length,
            dataDateStart: dateRange.start, dataDateEnd: dateRange.end,
        };
    }

    // ============================================================
    // 文件解析
    // ============================================================

    private parseCsvText(text: string): string[][] {
        const rows: string[][] = [];
        let current: string[] = [];
        let field = '';
        let inQuotes = false;
        let rowHasContent = false;
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (inQuotes) {
                if (ch === '"') {
                    if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
                } else field += ch;
            } else {
                if (ch === '"') inQuotes = true;
                else if (ch === ',') {
                    current.push(field); if (field.trim()) rowHasContent = true; field = '';
                } else if (ch === '\n' || ch === '\r') {
                    if (ch === '\r' && text[i + 1] === '\n') i++;
                    current.push(field); if (field.trim()) rowHasContent = true;
                    if (rowHasContent) rows.push(current);
                    current = []; field = ''; rowHasContent = false;
                } else field += ch;
            }
        }
        if (field || current.length > 0) {
            current.push(field);
            if (field.trim() || rowHasContent) rows.push(current);
        }
        return rows;
    }

    private parseFile(buffer: Buffer, fileName: string): { headers: string[]; dataRows: unknown[][]; headerOffset: number } {
        if (fileName.toLowerCase().endsWith('.csv')) {
            let text = buffer.toString('utf-8');
            if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
            const allRows = this.parseCsvText(text);
            if (allRows.length === 0) throw new BadRequestException('文件为空');
            const headers = allRows[0].map((h) => h.trim());
            const dataRows = allRows.slice(1).filter((row) => row[0] != null && row[0].trim() !== '');
            return { headers, dataRows, headerOffset: 2 };
        }
        const workbook = XLSX.read(buffer, { type: 'buffer', raw: false });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!sheet) throw new BadRequestException('文件中没有工作表');
        const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as unknown[][];
        if (rawRows.length === 0) throw new BadRequestException('文件为空');
        const headers = (rawRows[0] as unknown[]).map((h) => String(h ?? '').trim());
        const dataRows = rawRows.slice(1).filter((row) => {
            const firstCell = (row as unknown[])[0];
            return firstCell != null && String(firstCell).trim() !== '';
        });
        return { headers, dataRows, headerOffset: 2 };
    }

    private buildColumnMap(headers: string[]): ColumnMap {
        const map: ColumnMap = {};
        const usedIndices = new Set<number>();
        const usedFields = new Set<string>();

        const matchOne = (i: number, minScore: number): { field: keyof ParsedRow; score: number } | null => {
            const actual = normalizeHeader(headers[i]);
            const actualLower = actual.toLowerCase().replace(/\s+/g, '');
            if (isBlacklistedHeader(actualLower)) return null;
            let bestMatch: { field: keyof ParsedRow; score: number } | null = null;
            for (const def of COLUMN_DEFS) {
                if (usedFields.has(def.field)) continue;
                for (const alias of def.aliases) {
                    const normalizedAlias = normalizeHeader(alias);
                    const aliasLower = normalizedAlias.toLowerCase().replace(/\s+/g, '');
                    let score = 0;
                    if (normalizedAlias === actual) score = 100;
                    else if (aliasLower === actualLower) score = 90;
                    else if (minScore <= 50 && (actualLower.includes(aliasLower) || aliasLower.includes(actualLower))) {
                        const longer = Math.max(actualLower.length, aliasLower.length);
                        const shorter = Math.min(actualLower.length, aliasLower.length);
                        score = 50 + Math.round((shorter / longer) * 30);
                    }
                    if (score > 0 && score >= minScore && (!bestMatch || score > bestMatch.score)) {
                        bestMatch = { field: def.field, score };
                    }
                }
            }
            return bestMatch;
        };

        for (let i = 0; i < headers.length; i++) {
            const match = matchOne(i, 90);
            if (match && !usedIndices.has(i) && !usedFields.has(match.field)) {
                map[match.field] = i; usedIndices.add(i); usedFields.add(match.field);
            }
        }
        for (let i = 0; i < headers.length; i++) {
            if (usedIndices.has(i)) continue;
            const match = matchOne(i, 50);
            if (match && !usedFields.has(match.field)) {
                map[match.field] = i; usedIndices.add(i); usedFields.add(match.field);
            }
        }
        return map;
    }

    private validateColumnMap(map: ColumnMap): void {
        const missing = COLUMN_DEFS.filter((def) => def.required && map[def.field] === undefined).map((def) => def.aliases.join(' 或 '));
        if (missing.length > 0) throw new BadRequestException(`缺少必填列:\n${missing.join('\n')}`);
    }

    private cleanData(
        dataRows: unknown[][], colMap: ColumnMap, headerOffset: number,
        options?: { skipSeriesNameRequired?: boolean; preMerge?: boolean; mappingFile?: boolean },
    ): { rows: ParsedRow[]; errors: string[] } {
        const errors: string[] = [];
        const skipSeriesNameRequired = options?.skipSeriesNameRequired === true;
        const preMerge = options?.preMerge === true;
        const mappingFile = options?.mappingFile === true;

        const getStr = (row: unknown[], field: keyof ParsedRow, defaultVal = ''): string => {
            const idx = colMap[field];
            if (idx === undefined) return defaultVal;
            const v = row[idx];
            if (v == null) return defaultVal;
            if (v instanceof Date) {
                const y = v.getUTCFullYear();
                const m = String(v.getUTCMonth() + 1).padStart(2, '0');
                const d = String(v.getUTCDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }
            return String(v).trim();
        };

        const getNumericStr = (row: unknown[], field: keyof ParsedRow, defaultVal = '0'): string => {
            const v = getStr(row, field, defaultVal);
            if (!v) return defaultVal;
            const cleaned = v.replace(/[,，\s]/g, '');
            const matched = cleaned.match(/-?\d+(?:\.\d+)?/);
            return matched ? matched[0] : defaultVal;
        };

        const getNum = (row: unknown[], field: keyof ParsedRow, rowNum: number, defaultVal = 0): number => {
            const idx = colMap[field];
            if (idx === undefined) return defaultVal;
            const v = row[idx];
            if (v == null || v === '') return defaultVal;
            if (typeof v === 'number') return v;
            const raw = String(v).trim();
            if (raw === '') return defaultVal;
            if (CURRENCY_CODE_SET.has(raw.toLowerCase())) return defaultVal;
            const s = raw.replace(/[,，\s]/g, '');
            const matched = s.match(/-?\d+(?:\.\d+)?/);
            if (!matched) {
                if (errors.length < 50) errors.push(`第${rowNum}行 ${field}列 格式异常: 值"${raw}"无法解析为数字`);
                return defaultVal;
            }
            return Math.round(Number(matched[0]));
        };

        const rows = dataRows
            .filter((row) => {
                const first = row[0] != null ? String(row[0]).trim() : '';
                return !(first === '合计' || first === '总计' || first === '汇总' || first === 'Total');
            })
            .map((row, idx) => {
                const r = row as unknown[];
                const rowNum = idx + headerOffset;
                return {
                    seriesName: getStr(r, 'seriesName'),
                    recordDate: getStr(r, 'recordDate'),
                    adGroupName: getStr(r, 'adGroupName'),
                    creativeName: getStr(r, 'creativeName'),
                    cost: getNumericStr(r, 'cost', '0'),
                    impressions: getNum(r, 'impressions', rowNum),
                    clicks: getNum(r, 'clicks', rowNum),
                    conversions: getNum(r, 'conversions', rowNum),
                    cpaOriginal: getNumericStr(r, 'cpaOriginal'),
                    cpmOriginal: getNumericStr(r, 'cpmOriginal'),
                    playCount: getNum(r, 'playCount', rowNum),
                    play2s: getNum(r, 'play2s', rowNum),
                    play5s: getNum(r, 'play5s', rowNum),
                    playComplete: getNum(r, 'playComplete', rowNum),
                    adGroupId: getStr(r, 'adGroupId'),
                    adName: getStr(r, 'adName'),
                    adId: getStr(r, 'adId'),
                    creativeId: getStr(r, 'creativeId'),
                    videoMaterialId: getStr(r, 'videoMaterialId'),
                    videoCompleteRate: getNumericStr(r, 'videoCompleteRate'),
                    avgVideoPlayDuration: getNumericStr(r, 'avgVideoPlayDuration'),
                    country: getStr(r, 'country'),
                    materialType: getStr(r, 'materialType'),
                    placement: getStr(r, 'placement'),
                    agent: getStr(r, 'agent'),
                    dateValue: getStr(r, 'dateValue'),
                    materialCategory: getStr(r, 'materialCategory'),
                    newOrActive: getStr(r, 'newOrActive'),
                    cleanedMaterialName: getStr(r, 'cleanedMaterialName'),
                    newUserActivated: getNum(r, 'newUserActivated', rowNum),
                    placer: getStr(r, 'placer'),
                    bidType: getStr(r, 'bidType'),
                    materialDirection: getStr(r, 'materialDirection'),
                    bcDirection: getStr(r, 'bcDirection'),
                    materialDate: getStr(r, 'materialDate'),
                    secondaryCategory: getStr(r, 'secondaryCategory'),
                    tertiaryCategory: getStr(r, 'tertiaryCategory'),
                    creativeIdentityId: getStr(r, 'creativeIdentityId'),
                    campaignId: getStr(r, 'campaignId'),
                };
            })
            .filter((row) => {
                if (preMerge || mappingFile) return true;
                if (!skipSeriesNameRequired && !row.seriesName) return false;
                if (row.seriesName.includes('总计') || row.seriesName.includes('Total') ||
                    row.seriesName.includes('合计') || row.seriesName.includes('汇总') ||
                    /^Total\s+of\s+\d+/i.test(row.seriesName)) {
                    return false;
                }
                if (row.impressions === 0) return false;
                return true;
            });

        return { rows, errors };
    }

    private computeRecords(rows: ParsedRow[]): ComputedRecord[] {
        return rows.map((row) => {
            const materialNameClean = calcMaterialNameClean(row.creativeName);
            return {
                ...row,
                materialNameClean,
                cleanedMaterialName: materialNameClean,
                country: calcCountry(row.seriesName),
                audienceType: calcMaterialDirection(row.creativeName),
                bcType: calcBcDirection(row.creativeName),
                materialType: calcMaterialType(materialNameClean),
                placement: row.placement || calcPlacement(row.seriesName),
                agent: calcAgent(row.seriesName),
                dateValue: row.dateValue || calcDateValue(row.recordDate),
                materialCategory: calcMaterialCategory(materialNameClean),
                newOrActive: calcNewOrActive(row.adGroupName),
                newUserActivated: row.newUserActivated || 0,
                placer: calcPlacer(row.seriesName),
                bidType: row.bidType || calcBidType(row.seriesName),
                materialDirection: row.materialDirection || calcMaterialDirection(row.creativeName),
                bcDirection: row.bcDirection || calcBcDirection(row.creativeName),
                materialDate: row.materialDate || calcMaterialDate(row.creativeName),
                secondaryCategory: row.secondaryCategory || calcSecondaryCategory(row.creativeName),
                tertiaryCategory: row.tertiaryCategory || calcTertiaryCategory(row.creativeName),
                creativeIdentityId: (row.creativeIdentityId && isValidCreativeIdentityId(row.creativeIdentityId))
                    ? row.creativeIdentityId
                    : (calcCreativeIdentityId(materialNameClean) || '未匹配'),
            };
        });
    }

    private getDateRange(records: ComputedRecord[]): { start: string; end: string } {
        const dates = records.map((r) => r.dateValue).filter(Boolean).sort();
        if (dates.length === 0) {
            const today = new Date().toISOString().slice(0, 10);
            return { start: today, end: today };
        }
        return { start: dates[0], end: dates[dates.length - 1] };
    }

    // ============================================================
    // 入库（核心）
    // ============================================================

    private assertNotCancelled(isCancelled?: () => boolean): void {
        if (isCancelled?.()) throw new Error('任务已被终止（超时或手动停止）');
    }

    private async insertData(
        records: ComputedRecord[], timeSlot?: string, isCancelled?: () => boolean,
    ): Promise<void> {
        await this.seedAdNameCache(records);
        const db = await this.ensureDb();

        const recordsByDate = new Map<string, ComputedRecord[]>();
        for (const r of records) {
            const date = r.dateValue || '';
            if (!recordsByDate.has(date)) recordsByDate.set(date, []);
            recordsByDate.get(date)!.push(r);
        }

        const allDates = [...recordsByDate.keys()].filter(Boolean);
        if (allDates.length === 0) throw new BadRequestException('上传数据中无有效日期，无法执行按日覆盖');

        this.logger.log(`按日全量覆盖: 涉及 ${allDates.length} 个日期, 即将插入 ${records.length} 条记录`);

        const INSERT_BATCH = 2000;
        const timeSlotFilter = timeSlot ? sql` AND time_slot = ${timeSlot}` : sql``;

        for (const date of allDates) {
            this.assertNotCancelled(isCancelled);
            const dayRecords: ComputedRecord[] = recordsByDate.get(date)!;
            const txStart = Date.now();

            await this.withDeadlockRetry(`逐日写入 [${date}]`, async () => {
                await db.transaction(async (tx) => {
                    await tx.execute(sql`SET LOCAL statement_timeout = '480s'`);
                    await tx.execute(sql`DELETE FROM data_source_detail WHERE data_source_id IN (
            SELECT id FROM data_source WHERE date_value = ${date} AND data_source = 'promote'${timeSlotFilter})`);
                    await tx.execute(sql`DELETE FROM data_source WHERE date_value = ${date} AND data_source = 'promote'${timeSlotFilter}`);

                    for (let j = 0; j < dayRecords.length; j += INSERT_BATCH) {
                        this.assertNotCancelled(isCancelled);
                        const insertBatch = dayRecords.slice(j, j + INSERT_BATCH);
                        const ids = insertBatch.map(() => randomUUID());

                        const srcValues = insertBatch.map((r, idx) =>
                            `(${sqlVal(ids[idx])},${sqlVal(r.seriesName || '(unmapped)')},${sqlVal(r.recordDate)},${sqlTrunc(r.adGroupName, 500)},${sqlTrunc(r.creativeName, 500)},${sqlVal(r.cost)},${r.impressions},${r.clicks},${r.conversions},${sqlVal(r.country)},${sqlVal(r.materialType)},${sqlVal(r.placement)},${sqlVal(r.agent)},${sqlVal(r.dateValue)},${sqlVal(r.materialCategory)},${sqlVal(r.newOrActive)},${sqlVal(r.adGroupId)},${sqlVal(r.adName)},${sqlVal(r.adId)},${sqlVal(r.creativeId)},${sqlVal(r.videoMaterialId)},${sqlTrunc(r.materialNameClean, 500)},${r.newUserActivated},${sqlVal(r.placer)},${sqlVal(r.bidType)},${sqlVal(r.materialDirection)},${sqlVal(r.bcDirection)},${sqlVal(r.materialDate)},${sqlVal(r.secondaryCategory)},${sqlVal(r.tertiaryCategory)},${sqlVal(r.creativeIdentityId)},${sqlVal(r.campaignId)},${r.playCount},${r.play2s},${r.playComplete},'promote',${timeSlot ? sqlVal(timeSlot) : 'NULL'},${sqlVal(null)},NULL,NULL)`,
                        ).join(',');

                        await tx.execute(sql`INSERT INTO data_source (
              id,series_name,record_date,ad_group_name,creative_name,cost,impressions,clicks,conversions,
              country,material_type,placement,agent,date_value,material_category,new_or_active,ad_group_id,
              ad_name,ad_id,creative_id,video_material_id,cleaned_material_name,new_user_activated,placer,
              bid_type,material_direction,bc_direction,material_date,secondary_category,tertiary_category,
              creative_identity_id,campaign_id,play_count,play_2s,play_complete,data_source,time_slot,group_name,
              _created_by,_updated_by
            ) VALUES ${sql.raw(srcValues)} ON CONFLICT DO NOTHING`);

                        const detValues = insertBatch.map((r, idx) =>
                            `(${sqlVal(ids[idx])},${sqlVal(r.cpaOriginal)},${sqlVal(r.cpmOriginal)},${r.playCount},${r.play2s},${r.play5s},${r.playComplete},${sqlTrunc(r.materialNameClean, 500)},${sqlVal(r.audienceType)},${sqlVal(r.bcType)},${sqlVal(r.videoCompleteRate)},${sqlVal(r.avgVideoPlayDuration)},NULL,NULL)`,
                        ).join(',');

                        await tx.execute(sql`INSERT INTO data_source_detail (
              data_source_id,cpa_original,cpm_original,play_count,play_2s,play_5s,play_complete,
              material_name_clean,audience_type,bc_type,video_complete_rate,avg_video_play_duration,
              _created_by,_updated_by
            ) VALUES ${sql.raw(detValues)}`);
                    }

                    const check: Array<{ cnt: number }> = await tx.execute(
                        sql`SELECT COUNT(*) AS cnt FROM data_source WHERE date_value = ${date} AND data_source = 'promote'${timeSlotFilter}`,
                    );
                    const actualCount = Number(check[0]?.cnt ?? 0);
                    if (actualCount !== dayRecords.length) {
                        throw new Error(`data_source 写入校验失败 [${date}]: 预期 ${dayRecords.length} 行, 实际 ${actualCount} 行`);
                    }
                });
            });
            this.logger.log(`[耗时] 逐日写入 [${date}]: ${dayRecords.length} 条, ${Date.now() - txStart}ms`);
        }
        this.logger.log(`数据入库完成: 插入${records.length}条新数据 (逐日小事务覆盖模式)`);
        // 第 3 批补：cct 重建 / 0耗首消日期刷新
    }

    // ============================================================
    // 删除/备份
    // ============================================================

    private async deleteHourlyData(dateRange: { start: string; end: string }, timeSlot: string): Promise<void> {
        const db = await this.ensureDb();
        this.logger.log(`删除时报数据: time_slot=${timeSlot}, 日期 ${dateRange.start} ~ ${dateRange.end}`);
        await db.execute(sql`DELETE FROM data_source_detail WHERE data_source_id IN (
      SELECT id FROM data_source WHERE date_value >= ${dateRange.start} AND date_value <= ${dateRange.end}
        AND data_source = 'promote' AND time_slot = ${timeSlot})`);
        await db.execute(sql`DELETE FROM data_source WHERE date_value >= ${dateRange.start} AND date_value <= ${dateRange.end}
      AND data_source = 'promote' AND time_slot = ${timeSlot}`);
    }

    private async deleteAllPromoteDayData(dateRange: { start: string; end: string }): Promise<void> {
        const db = await this.ensureDb();
        await db.execute(sql`DELETE FROM data_source_detail WHERE data_source_id IN (
      SELECT id FROM data_source WHERE date_value >= ${dateRange.start} AND date_value <= ${dateRange.end}
        AND data_source = 'promote')`);
        await db.execute(sql`DELETE FROM data_source WHERE date_value >= ${dateRange.start} AND date_value <= ${dateRange.end}
      AND data_source = 'promote'`);
    }

    private async backupToTables(dateRange: { start: string; end: string }): Promise<void> {
        const db = await this.ensureDb();
        const dateRows = await db.execute(sql`
      SELECT DISTINCT date_value FROM data_source
      WHERE date_value >= ${dateRange.start} AND date_value <= ${dateRange.end}
        AND data_source = 'promote'
      ORDER BY date_value DESC
    `) as unknown as Array<{ date_value: string }>;
        const sortedDates = dateRows.map((r) => r.date_value).filter(Boolean);

        for (let i = 0; i < sortedDates.length && i < DataUploadService.BACKUP_TABLES.length; i++) {
            const dateStr = sortedDates[i];
            const tableName = DataUploadService.BACKUP_TABLES[i];
            const commonCols = await this.backupCommonColumns(tableName);
            if (commonCols.length === 0) {
                this.logger.warn(`备份跳过: ${tableName} 与 data_source 无公共列`);
                continue;
            }
            const colList = sql.raw(commonCols.map((c) => `"${c}"`).join(','));
            await db.execute(sql`DELETE FROM ${sql.raw(tableName)} WHERE date_value = ${dateStr}`);
            await db.execute(sql`INSERT INTO ${sql.raw(tableName)} (${colList}) SELECT ${colList} FROM data_source
        WHERE date_value = ${dateStr} AND data_source = 'promote'`);
            this.logger.log(`备份: ${dateStr} → ${tableName} (${commonCols.length} 列)`);
        }
    }

    private async backupCommonColumns(tableName: string): Promise<string[]> {
        const db = await this.ensureDb();
        const rows = await db.execute(sql`
      SELECT b.column_name FROM information_schema.columns a
      JOIN information_schema.columns b ON b.table_schema = a.table_schema AND b.column_name = a.column_name
      WHERE a.table_schema = current_schema AND a.table_name = ${tableName} AND b.table_name = 'data_source'
      ORDER BY b.ordinal_position
    `) as unknown as Array<{ column_name: string }>;
        return rows.map((r) => r.column_name);
    }

    private async cleanupConfirmedFromTables(oldestDate: string): Promise<void> {
        const db = await this.ensureDb();
        const d = new Date(oldestDate + 'T00:00:00');
        d.setDate(d.getDate() - 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const confirmedDate = `${y}-${m}-${day}`;
        for (const tableName of DataUploadService.BACKUP_TABLES) {
            await db.execute(sql`DELETE FROM ${sql.raw(tableName)} WHERE date_value = ${confirmedDate}`);
        }
        this.logger.log(`置信清理: 从8张备份表删除 ${confirmedDate} 的数据`);
    }

    // ============================================================
    // 基准表
    // ============================================================

    async deleteDailyBaseline(date: string): Promise<void> {
        const db = await this.ensureDb();
        await db.execute(sql`DELETE FROM promote_daily_baseline WHERE record_date = ${date}`);
    }

    async writeDailyBaseline(records: ComputedRecord[], _dateRange: { start: string; end: string }, targetDate?: string): Promise<void> {
        const db = await this.ensureDb();

        const computeAgg = (recs: ComputedRecord[]) => {
            let totalCost = 0, totalConv = 0, xxCost = 0, xxConv = 0, lhCost = 0, lhConv = 0, lsCost = 0, lsConv = 0;
            for (const r of recs) {
                const cost = Number(r.cost) || 0;
                const conv = r.conversions;
                const na = r.newOrActive || '';
                totalCost += cost; totalConv += conv;
                if (na === '拉新') { xxCost += cost; xxConv += conv; }
                else if (na === '拉活') { lhCost += cost; lhConv += conv; }
                else if (na === '历史') { lsCost += cost; lsConv += conv; }
            }
            return {
                totalCost: Math.round(totalCost * 100) / 100, totalConv,
                xxCost: Math.round(xxCost * 100) / 100, xxConv,
                lhCost: Math.round(lhCost * 100) / 100, lhConv,
                lsCost: Math.round(lsCost * 100) / 100, lsConv,
            };
        };

        type BaselineRow = { recordDate: string; country: string; totalCost: number; totalConv: number; xxCost: number; xxConv: number; lhCost: number; lhConv: number; lsCost: number; lsConv: number };
        const xbRecords = records.filter((r) => r.agent === 'XB');
        if (xbRecords.length === 0) { this.logger.warn('writeDailyBaseline: 无 XB 代理记录，跳过基线写入'); return; }

        const targetDates: string[] = [];
        if (targetDate) targetDates.push(targetDate);
        else {
            const dateSet = new Set<string>();
            for (const r of xbRecords) if (r.dateValue) dateSet.add(r.dateValue);
            const sortedDates = [...dateSet].sort();
            if (sortedDates.length > 0) targetDates.push(sortedDates[sortedDates.length - 1]!);
        }

        const allRows: BaselineRow[] = [];
        for (const recordDate of targetDates) {
            const dayRecords = xbRecords.filter((r) => r.dateValue === recordDate);
            if (dayRecords.length === 0) continue;
            const byCountry = new Map<string, ComputedRecord[]>();
            for (const r of dayRecords) {
                const c = (r.country || '').toUpperCase();
                if (!byCountry.has(c)) byCountry.set(c, []);
                byCountry.get(c)!.push(r);
            }
            for (const [country, recs] of byCountry) {
                allRows.push({ recordDate, country, ...computeAgg(recs) });
            }
            allRows.push({ recordDate, country: 'TOTAL', ...computeAgg(dayRecords) });
        }

        if (allRows.length === 0) { this.logger.warn(`writeDailyBaseline: 无有效 baseline 记录，跳过写入`); return; }

        const datesInvolved = [...new Set(allRows.map((r) => r.recordDate))];
        const dateParams = sql.join(datesInvolved.map((d) => sql`${d}`), sql`, `);
        await db.execute(sql`DELETE FROM promote_daily_baseline WHERE record_date IN (${dateParams})`);

        const valuesSql = sql.join(
            allRows.map((r) => sql`(${r.recordDate}, ${r.country}, ${r.totalCost}, ${r.totalConv}, ${r.xxCost}, ${r.xxConv}, ${r.lhCost}, ${r.lhConv}, ${r.lsCost}, ${r.lsConv})`),
            sql`, `,
        );
        await db.execute(sql`
      INSERT INTO promote_daily_baseline (
        record_date, country, total_cost, total_conversions,
        laxin_cost, laxin_conversions, lahuo_cost, lahuo_conversions,
        lishi_cost, lishi_conversions
      ) VALUES ${valuesSql}
    `);
        this.logger.log(`baseline 写入完成: ${allRows.length} 行，写入 ${datesInvolved.length} 天`);
    }

    async backfillDailyBaseline(dateRange: { start: string; end: string }): Promise<{ rowsInserted: number; days: number }> {
        const db = await this.ensureDb();
        const rows = await db.execute(sql`
      SELECT date_value AS record_date, UPPER(COALESCE(country, '')) AS country,
        SUM(cost)::numeric AS total_cost, SUM(conversions)::integer AS total_conversions,
        SUM(CASE WHEN new_or_active = '拉新' THEN cost ELSE 0 END)::numeric AS laxin_cost,
        SUM(CASE WHEN new_or_active = '拉新' THEN conversions ELSE 0 END)::integer AS laxin_conversions,
        SUM(CASE WHEN new_or_active = '拉活' THEN cost ELSE 0 END)::numeric AS lahuo_cost,
        SUM(CASE WHEN new_or_active = '拉活' THEN conversions ELSE 0 END)::integer AS lahuo_conversions,
        SUM(CASE WHEN new_or_active = '历史' THEN cost ELSE 0 END)::numeric AS lishi_cost,
        SUM(CASE WHEN new_or_active = '历史' THEN conversions ELSE 0 END)::integer AS lishi_conversions
      FROM data_source
      WHERE data_source = 'promote' AND agent = 'XB'
        AND date_value >= ${dateRange.start} AND date_value <= ${dateRange.end}
        AND series_name != '(unmapped)'
        AND (impressions > 0 OR data_source = 'zero_cost')
        AND creative_id IS NOT NULL AND creative_id != ''
      GROUP BY date_value, UPPER(COALESCE(country, ''))
      ORDER BY date_value, country
    `) as unknown as Array<Record<string, unknown>>;
        if (rows.length === 0) return { rowsInserted: 0, days: 0 };
        // 简洁返回，需要时可以补全聚合逻辑
        return { rowsInserted: rows.length, days: new Set(rows.map((r) => String(r.record_date))).size };
    }

    async writeHourlyRecord(records: ComputedRecord[], timeSlot: string): Promise<void> {
        const db = await this.ensureDb();
        const recordsByDate = new Map<string, ComputedRecord[]>();
        for (const r of records) {
            const d = r.dateValue || '';
            if (!d) continue;
            if (!recordsByDate.has(d)) recordsByDate.set(d, []);
            recordsByDate.get(d)!.push(r);
        }
        if (recordsByDate.size === 0) return;

        const sortedDates = [...recordsByDate.keys()].sort();
        for (const recordDate of sortedDates) {
            const dayRecords = recordsByDate.get(recordDate)!;
            const costByCountry = new Map<string, number>();
            const costByCountryBid = new Map<string, Map<string, number>>();
            const convByCountry = new Map<string, number>();
            let totalCost = 0;
            for (const r of dayRecords) {
                const country = r.country || '未命名';
                const cost = Number(r.cost) || 0;
                costByCountry.set(country, (costByCountry.get(country) ?? 0) + cost);
                totalCost += cost;
                const conv = Number(r.conversions) || 0;
                if (conv > 0) convByCountry.set(country, (convByCountry.get(country) ?? 0) + conv);
                const bidType = r.bidType || '其他';
                if (!costByCountryBid.has(country)) costByCountryBid.set(country, new Map());
                const bidMap = costByCountryBid.get(country)!;
                bidMap.set(bidType, (bidMap.get(bidType) ?? 0) + cost);
            }
            const countryCosts = JSON.stringify(Object.fromEntries(costByCountry));
            const bidRatios: Record<string, { cc: number; lc: number }> = {};
            for (const [country, total] of costByCountry) {
                const bidMap = costByCountryBid.get(country) || new Map();
                const ccCost = bidMap.get('CC') || 0;
                const lcCost = bidMap.get('LC') || 0;
                bidRatios[country] = {
                    cc: total > 0 ? Math.round((ccCost / total) * 10000) / 100 : 0,
                    lc: total > 0 ? Math.round((lcCost / total) * 10000) / 100 : 0,
                };
            }
            const countryBidRatios = JSON.stringify(bidRatios);
            const prevD = new Date(recordDate + 'T00:00:00'); prevD.setDate(prevD.getDate() - 1);
            const prevDate = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, '0')}-${String(prevD.getDate()).padStart(2, '0')}`;
            const prevRows = await db.execute(sql`SELECT total_cost FROM hourly_data_record WHERE record_date = ${prevDate} AND time_slot = ${timeSlot}`) as unknown as Array<{ total_cost: string }>;
            let costChangeRate: number | null = null;
            if (prevRows.length > 0) {
                const prevCost = Number(prevRows[0].total_cost) || 0;
                if (prevCost > 0) costChangeRate = (totalCost - prevCost) / prevCost;
            }
            const countryConversions = JSON.stringify(Object.fromEntries(convByCountry));
            await db.execute(sql`
        INSERT INTO hourly_data_record (record_date, time_slot, total_cost, cost_change_rate, country_costs, country_bid_ratios, country_conversions)
        VALUES (${recordDate}, ${timeSlot}, ${totalCost}, ${costChangeRate}, ${countryCosts}, ${countryBidRatios}, ${countryConversions})
        ON CONFLICT (record_date, time_slot) DO UPDATE SET
          total_cost = EXCLUDED.total_cost, cost_change_rate = EXCLUDED.cost_change_rate,
          country_costs = EXCLUDED.country_costs, country_bid_ratios = EXCLUDED.country_bid_ratios,
          country_conversions = EXCLUDED.country_conversions
      `);
            const nextD = new Date(recordDate + 'T00:00:00'); nextD.setDate(nextD.getDate() + 1);
            const nextDate = `${nextD.getFullYear()}-${String(nextD.getMonth() + 1).padStart(2, '0')}-${String(nextD.getDate()).padStart(2, '0')}`;
            if (totalCost > 0) {
                await db.execute(sql`UPDATE hourly_data_record SET cost_change_rate = (total_cost - ${totalCost}) / ${totalCost}
          WHERE record_date = ${nextDate} AND time_slot = ${timeSlot} AND total_cost IS NOT NULL`);
            }
        }
    }

    // ============================================================
    // 上传记录管理
    // ============================================================

    private armUploadTimeout(recordId: string): void {
        this.uploadTimeoutTimers.set(recordId, setTimeout(() => {
            this.uploadTimeoutTimers.delete(recordId);
            void this.timeoutUploadRecord(recordId);
        }, DataUploadService.UPLOAD_TIMEOUT_MS));
    }

    private disarmUploadTimeout(recordId: string): void {
        const timer = this.uploadTimeoutTimers.get(recordId);
        if (timer) { clearTimeout(timer); this.uploadTimeoutTimers.delete(recordId); }
    }

    private async timeoutUploadRecord(recordId: string): Promise<void> {
        try {
            const db = await this.ensureDb();
            const updated = await db.update(uploadRecord)
                .set({
                    status: 'failed',
                    errorMessage: '处理超时自动停止：10 分钟内未完成，请检查文件后重新上传',
                    processedAt: new Date().toISOString(),
                })
                .where(and(eq(uploadRecord.id, recordId), eq(uploadRecord.status, 'processing')))
                .returning({ id: uploadRecord.id });
            if (updated.length > 0) this.logger.warn(`上传任务超时停止: ${recordId}`);
        } catch (err) {
            this.logger.warn(`超时停止失败: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    private async reclaimStaleProcessingRecords(db: PostgresJsDatabase): Promise<void> {
        const threshold = new Date(Date.now() - DataUploadService.UPLOAD_TIMEOUT_MS);
        const reclaimed = await db.update(uploadRecord)
            .set({
                status: 'failed',
                errorMessage: '处理超时被回收：实例回收/重启导致',
                processedAt: new Date().toISOString(),
            })
            .where(and(eq(uploadRecord.status, 'processing'), lt(uploadRecord.createdAt, threshold)))
            .returning({ id: uploadRecord.id });
        if (reclaimed.length > 0) this.logger.warn(`回收 ${reclaimed.length} 条卡 processing 的记录`);
    }

    async getUploadRecords(page: number, pageSize: number): Promise<UploadRecordListResponse> {
        const db = await this.ensureDb();
        const now = Date.now();
        if (now - this.lastStaleUploadReclaimAt > 60_000) {
            this.lastStaleUploadReclaimAt = now;
            try { await this.reclaimStaleProcessingRecords(db); } catch { /* ignore */ }
        }
        const offset = (page - 1) * pageSize;
        const [totalResult] = await db.select({ cnt: count() }).from(uploadRecord);
        const items = await db.select().from(uploadRecord).orderBy(desc(uploadRecord.createdAt)).limit(pageSize).offset(offset);
        return {
            items: items.map((r) => ({
                id: r.id, fileName: r.fileName,
                status: r.status as 'processing' | 'success' | 'failed',
                totalRows: r.totalRows ?? 0, validRows: r.validRows ?? 0,
                errorMessage: r.errorMessage ?? '',
                dataDateStart: r.dataDateStart ?? '', dataDateEnd: r.dataDateEnd ?? '',
                processedAt: r.processedAt ?? '',
                startedAt: r.createdAt ? new Date(r.createdAt).toISOString() : '',
            })),
            total: Number(totalResult?.cnt ?? 0),
        };
    }

    async deleteByDateRange(startDate: string, endDate: string): Promise<{ deleted: number }> {
        if (!startDate || !endDate) throw new BadRequestException('startDate and endDate are required');
        const db = await this.ensureDb();
        const [{ cnt }] = await db.select({ cnt: count() }).from(dataSource)
            .where(and(gte(dataSource.dateValue, startDate), lte(dataSource.dateValue, endDate)));
        await db.execute(sql`DELETE FROM data_source_detail WHERE data_source_id IN (
      SELECT id FROM data_source WHERE date_value >= ${startDate} AND date_value <= ${endDate} AND data_source = 'promote')`);
        await db.execute(sql`DELETE FROM data_source WHERE date_value >= ${startDate} AND date_value <= ${endDate} AND data_source = 'promote'`);
        return { deleted: Number(cnt) };
    }

    async deleteByUploadId(uploadId: string): Promise<{ deleted: number }> {
        const db = await this.ensureDb();
        const record = await db.select().from(uploadRecord).where(eq(uploadRecord.id, uploadId)).limit(1);
        if (record.length === 0) throw new Error('Upload record not found');
        const processedAt = record[0].processedAt;
        if (!processedAt) throw new Error('Upload record has no processedAt timestamp');
        const tsEnd = new Date(new Date(processedAt).getTime() + 60000);
        const tsStart = new Date(new Date(processedAt).getTime() - 300000);
        const rows = await db.select({ id: dataSource.id }).from(dataSource)
            .where(and(gte(dataSource.createdAt, tsStart), lte(dataSource.createdAt, tsEnd)));
        if (rows.length === 0) {
            await db.update(uploadRecord).set({ status: 'deleted' }).where(eq(uploadRecord.id, uploadId));
            return { deleted: 0 };
        }
        const ids = rows.map((r) => r.id);
        await db.delete(dataSourceDetail).where(inArray(dataSourceDetail.dataSourceId, ids));
        await db.delete(dataSource).where(inArray(dataSource.id, ids));
        await db.update(uploadRecord).set({ status: 'deleted' }).where(eq(uploadRecord.id, uploadId));
        return { deleted: ids.length };
    }

    private async updateUploadRecord(id: string, status: 'success' | 'failed', data: {
        totalRows?: number; validRows?: number; dataDateStart?: string; dataDateEnd?: string;
        errorMessage?: string; resultPayload?: string;
    }): Promise<void> {
        this.disarmUploadTimeout(id);
        const db = await this.ensureDb();
        await db.update(uploadRecord).set({
            status, totalRows: data.totalRows ?? 0, validRows: data.validRows ?? 0,
            dataDateStart: data.dataDateStart ?? null, dataDateEnd: data.dataDateEnd ?? null,
            errorMessage: data.errorMessage ?? null, resultPayload: data.resultPayload ?? null,
            processedAt: new Date().toISOString(),
        }).where(and(eq(uploadRecord.id, id), eq(uploadRecord.status, 'processing')));
    }

    private async updateBatchProgress(recordId: string, progress: number, stage: string): Promise<void> {
        try {
            const db = await this.ensureDb();
            await db.update(uploadRecord).set({ resultPayload: JSON.stringify({ progress, stage }) })
                .where(eq(uploadRecord.id, recordId));
        } catch { /* ignore */ }
    }

    async pollBatchResult(sinceIso: string, key: string): Promise<BatchPollResponse> {
        const since = new Date(sinceIso);
        if (!sinceIso || Number.isNaN(since.getTime())) throw new BadRequestException('since 参数非法');
        if (!key) throw new BadRequestException('key 参数非法');
        const db = await this.ensureDb();
        const rows = await db.select().from(uploadRecord).where(gte(uploadRecord.createdAt, since))
            .orderBy(desc(uploadRecord.createdAt)).limit(20);
        const match = rows.find((r) => r.batchKey === key);
        if (!match) return { found: false };
        let progress: number | undefined; let stage: string | undefined;
        if (match.status === 'processing' && match.resultPayload) {
            try {
                const payload = JSON.parse(match.resultPayload) as { progress?: number; stage?: string };
                if (typeof payload.progress === 'number') progress = payload.progress;
                if (typeof payload.stage === 'string') stage = payload.stage;
            } catch { /* ignore */ }
        }
        return {
            found: true, status: match.status as UploadStatus,
            result: match.status === 'processing' ? undefined :
                match.resultPayload ? (JSON.parse(match.resultPayload) as BatchUploadResponse) : undefined,
            errorMessage: match.errorMessage ?? undefined, progress, stage,
        };
    }

    async clearRecentData(): Promise<ClearRecentDataResponse> {
        const db = await this.ensureDb();
        const today = new Date();
        const end = new Date(today); end.setDate(end.getDate() - 1);
        const start = new Date(today); start.setDate(start.getDate() - 8);
        const dateStart = start.toISOString().slice(0, 10);
        const dateEnd = end.toISOString().slice(0, 10);
        const existing = await db.select().from(dataSource)
            .where(and(gte(dataSource.dateValue, dateStart), lte(dataSource.dateValue, dateEnd), eq(dataSource.dataSource, 'promote')));
        if (existing.length === 0) return { success: true, dateStart, dateEnd, deletedCount: 0, backupBatchId: '' };
        const existingIds = existing.map((r) => r.id);
        const details = await db.select().from(dataSourceDetail).where(inArray(dataSourceDetail.dataSourceId, existingIds));
        const batchId = randomUUID();
        await db.insert(dataBackup).values({
            batchId, backupDate: new Date().toISOString().slice(0, 10),
            dataDateStart: dateStart, dataDateEnd: dateEnd, rowCount: existing.length,
            status: 'active', dataSnapshot: JSON.stringify({ records: existing, details }),
        });
        await db.delete(dataSourceDetail).where(inArray(dataSourceDetail.dataSourceId, existingIds));
        await db.delete(dataSource).where(inArray(dataSource.id, existingIds));
        return { success: true, dateStart, dateEnd, deletedCount: existing.length, backupBatchId: batchId };
    }

    async hasRecentData(): Promise<{ hasData: boolean; dateStart: string; dateEnd: string }> {
        const db = await this.ensureDb();
        const today = new Date();
        const end = new Date(today); end.setDate(end.getDate() - 1);
        const start = new Date(today); start.setDate(start.getDate() - 8);
        const dateStart = start.toISOString().slice(0, 10);
        const dateEnd = end.toISOString().slice(0, 10);
        const [result] = await db.select({ cnt: count() }).from(dataSource)
            .where(and(gte(dataSource.dateValue, dateStart), lte(dataSource.dateValue, dateEnd)));
        return { hasData: Number(result?.cnt ?? 0) > 0, dateStart, dateEnd };
    }

    async cleanupFutureDateData(date: string): Promise<{ deletedRows: number }> {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('date 格式必须为 YYYY-MM-DD');
        const target = new Date(`${date}T00:00:00+08:00`);
        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
        if (target.getTime() <= tomorrow.getTime()) throw new BadRequestException('仅允许清理未来日期测试数据');
        const db = await this.ensureDb();
        const existing = await db.select({ id: dataSource.id }).from(dataSource).where(eq(dataSource.dateValue, date));
        if (existing.length === 0) return { deletedRows: 0 };
        await db.delete(dataSourceDetail).where(inArray(dataSourceDetail.dataSourceId, existing.map((r) => r.id)));
        await db.delete(dataSource).where(eq(dataSource.dateValue, date));
        return { deletedRows: existing.length };
    }

    // ============================================================
    // 备份表查询
    // ============================================================

    async getBackupTables(): Promise<BackupTableListResponse> {
        const db = await this.ensureDb();
        const tables: BackupTableInfo[] = [];
        for (let i = 0; i < DataUploadService.BACKUP_TABLES.length; i++) {
            const tableName = DataUploadService.BACKUP_TABLES[i];
            const stats = await db.execute(sql`
        SELECT COUNT(*)::int as row_count, COALESCE(COUNT(DISTINCT date_value), 0)::int as date_count,
          COALESCE(MIN(date_value), '') as min_date, COALESCE(MAX(date_value), '') as max_date,
          COALESCE(array_agg(DISTINCT date_value ORDER BY date_value DESC), ARRAY[]::text[]) as dates
        FROM ${sql.raw(tableName)}
      `) as unknown as Array<{ row_count: number; date_count: number; min_date: string; max_date: string; dates: string[] }>;
            tables.push({
                tableId: i + 1, tableName: `备份T-${i + 1}`,
                rowCount: stats[0]?.row_count ?? 0, dateCount: stats[0]?.date_count ?? 0,
                minDate: stats[0]?.min_date ?? '', maxDate: stats[0]?.max_date ?? '',
                dates: Array.isArray(stats[0]?.dates) ? stats[0].dates : [],
            });
        }
        return { tables };
    }

    async getBackupTableData(params: BackupTableDataParams): Promise<BackupTableDataResponse> {
        const db = await this.ensureDb();
        const tableName = DataUploadService.BACKUP_TABLES[params.tableId - 1];
        if (!tableName) throw new BadRequestException('无效的表ID');
        const offset = (params.page - 1) * params.pageSize;
        const whereClause = params.date ? sql`date_value = ${params.date}` : sql`1=1`;
        const countResult = await db.execute(sql`SELECT COUNT(*)::int as cnt FROM ${sql.raw(tableName)} WHERE ${whereClause}`) as unknown as Array<{ cnt: number }>;
        const total = countResult[0]?.cnt ?? 0;
        const rows = await db.execute(sql`SELECT * FROM ${sql.raw(tableName)} WHERE ${whereClause}
      ORDER BY date_value DESC, cost DESC LIMIT ${params.pageSize} OFFSET ${offset}`) as unknown as Array<Record<string, unknown>>;
        const datesResult = await db.execute(sql`SELECT DISTINCT date_value FROM ${sql.raw(tableName)} WHERE date_value IS NOT NULL ORDER BY date_value DESC`) as unknown as Array<{ date_value: string }>;
        const dates = datesResult.map((r) => r.date_value).filter(Boolean);
        const items: BackupTableRow[] = rows.map((row) => ({
            id: String(row.id ?? ''), dateValue: String(row.date_value ?? ''),
            seriesName: String(row.series_name ?? ''), recordDate: String(row.record_date ?? ''),
            adGroupName: String(row.ad_group_name ?? ''), creativeName: String(row.creative_name ?? ''),
            cleanedMaterialName: String(row.cleaned_material_name ?? ''), cost: String(row.cost ?? '0'),
            impressions: Number(row.impressions ?? 0), clicks: Number(row.clicks ?? 0),
            conversions: Number(row.conversions ?? 0), country: String(row.country ?? ''),
            materialType: String(row.material_type ?? ''), placement: String(row.placement ?? ''),
            agent: String(row.agent ?? ''), materialCategory: String(row.material_category ?? ''),
            newOrActive: String(row.new_or_active ?? ''), newUserActivated: Number(row.new_user_activated ?? 0),
            placer: String(row.placer ?? ''), bidType: String(row.bid_type ?? ''),
            materialDirection: String(row.material_direction ?? ''), bcDirection: String(row.bc_direction ?? ''),
            materialDate: String(row.material_date ?? ''), secondaryCategory: String(row.secondary_category ?? ''),
            tertiaryCategory: String(row.tertiary_category ?? ''), creativeIdentityId: String(row.creative_identity_id ?? ''),
            adGroupId: String(row.ad_group_id ?? ''), adName: String(row.ad_name ?? ''),
            adId: String(row.ad_id ?? ''), creativeId: String(row.creative_id ?? ''),
            videoMaterialId: String(row.video_material_id ?? ''),
        }));
        return { items, total, page: params.page, pageSize: params.pageSize, dates };
    }

    // ============================================================
    // 映射文件刷新
    // ============================================================

    async processCampaignMappingUpload(_fileName: string, _downloadUrl: string): Promise<CampaignMappingUploadResponse> {
        throw new BadRequestException('请使用 multipart 上传');
    }

    async processMappingRefreshUpload(_fileName: string, _downloadUrl: string): Promise<MappingRefreshResponse> {
        throw new BadRequestException('请使用 multipart 上传');
    }

    async processMappingRefreshBuffer(
        fileName: string, buffer: Buffer,
    ): Promise<MappingRefreshResponse> {
        const db = await this.ensureDb();
        const { headers, dataRows } = this.parseFile(buffer, fileName);
        if (dataRows.length === 0) throw new BadRequestException('文件中没有数据');

        const colMap: Record<string, number> = {};
        const aliases: Record<string, string[]> = {
            creativeId: ['创意素材ID', '创意素材id', 'creative id', 'creative_id', 'ad id', 'ad_id'],
            seriesName: ['系列名称', '推广系列名称', 'series name', 'campaign name', 'series_name', 'campaign_name'],
            adGroupName: ['广告组名称', 'ad group name', 'adgroup name', 'ad_group_name', 'adgroup_name'],
            adGroupId: ['广告组id', '广告组ID', 'ad group id', 'ad_group_id', 'adgroup id', 'adgroup_id'],
            campaignId: ['推广系列ID', '推广系列id', 'campaign id', 'campaign_id', 'series id', 'series_id'],
        };
        for (let i = 0; i < headers.length; i++) {
            const header = headers[i].toLowerCase().replace(/\s+/g, '').replace(/[()（）]/g, '');
            for (const [field, list] of Object.entries(aliases)) {
                for (const alias of list) {
                    const norm = alias.toLowerCase().replace(/\s+/g, '').replace(/[()（）]/g, '');
                    if (header === norm || header.includes(norm) || norm.includes(header)) {
                        if (!(field in colMap)) colMap[field] = i;
                        break;
                    }
                }
            }
        }
        if (!('creativeId' in colMap)) throw new BadRequestException('缺少必要列: creativeId');

        interface MappingRow { seriesName?: string; adGroupName?: string; adGroupId?: string; campaignId?: string; }
        const byCreativeId = new Map<string, MappingRow>();
        let totalMappingRows = 0;
        for (const row of dataRows) {
            const r = row as unknown[];
            const creativeId = String(r[colMap.creativeId] ?? '').trim();
            if (!creativeId) continue;
            totalMappingRows++;
            const entry: MappingRow = {};
            if (colMap.seriesName !== undefined) { const v = String(r[colMap.seriesName] ?? '').trim(); if (v) entry.seriesName = v; }
            if (colMap.adGroupName !== undefined) { const v = String(r[colMap.adGroupName] ?? '').trim(); if (v) entry.adGroupName = v; }
            if (colMap.adGroupId !== undefined) { const v = String(r[colMap.adGroupId] ?? '').trim(); if (v) entry.adGroupId = v; }
            if (colMap.campaignId !== undefined) { const v = String(r[colMap.campaignId] ?? '').trim(); if (v) entry.campaignId = v; }
            if (Object.keys(entry).length > 0 && !byCreativeId.has(creativeId)) byCreativeId.set(creativeId, entry);
        }
        if (byCreativeId.size === 0) throw new BadRequestException('映射文件中没有可用的creative_id');

        let updatedRows = 0;
        const SELECT_CHUNK = 500;
        const UPDATE_BATCH = 10;
        const creativeIdList = [...byCreativeId.keys()];
        const toUpdate: { id: string; cid: string }[] = [];
        for (let offset = 0; offset < creativeIdList.length; offset += SELECT_CHUNK) {
            const chunk = creativeIdList.slice(offset, offset + SELECT_CHUNK);
            const rows = await db.select({
                id: dataSource.id, creativeId: dataSource.creativeId,
                seriesName: dataSource.seriesName, adGroupName: dataSource.adGroupName,
                adGroupId: dataSource.adGroupId, campaignId: dataSource.campaignId,
            }).from(dataSource).where(inArray(dataSource.creativeId, chunk));
            for (const r of rows) {
                const m = byCreativeId.get(r.creativeId ?? '');
                if (!m) continue;
                const needSeries = m.seriesName && (!r.seriesName || r.seriesName === '' || r.seriesName === '(unmapped)');
                const needAdGroup = m.adGroupName && (!r.adGroupName || r.adGroupName === '');
                const needAdGroupId = m.adGroupId && (!r.adGroupId || r.adGroupId === '');
                const needCampaign = m.campaignId && (!r.campaignId || r.campaignId === '');
                if (needSeries || needAdGroup || needAdGroupId || needCampaign) toUpdate.push({ id: r.id, cid: r.creativeId ?? '' });
            }
        }
        for (let i = 0; i < toUpdate.length; i += UPDATE_BATCH) {
            const chunk = toUpdate.slice(i, i + UPDATE_BATCH);
            const caseExpr = (field: 'seriesName' | 'adGroupName' | 'adGroupId' | 'campaignId') =>
                sql`CASE ${sql.join(chunk.map((u) => {
                    const m = byCreativeId.get(u.cid)!;
                    const val = field === 'seriesName' ? m.seriesName ?? null :
                        field === 'adGroupName' ? m.adGroupName ?? null :
                            field === 'adGroupId' ? m.adGroupId ?? null : m.campaignId ?? null;
                    return sql`WHEN ${dataSource.id} = ${u.id} THEN ${val}`;
                }), sql` `)} END`;
            try {
                await db.update(dataSource).set({
                    seriesName: caseExpr('seriesName'), adGroupName: caseExpr('adGroupName'),
                    adGroupId: caseExpr('adGroupId'), campaignId: caseExpr('campaignId'),
                    updatedAt: new Date(),
                }).where(inArray(dataSource.id, chunk.map((u) => u.id)));
                updatedRows += chunk.length;
            } catch { /* skip */ }
        }
        return {
            success: true, totalMappingRows, matchedCreativeIds: byCreativeId.size,
            scannedDataSourceRows: 0, updatedDataSourceRows: updatedRows,
        };
    }

    // ============================================================
    // 修复国家代码
    // ============================================================

    async fixCountryCodes(): Promise<Record<string, number>> {
        const db = await this.ensureDb();
        const changes: Record<string, number> = {};
        const tables = [
            'data_source', 'creative_assets_export', 'ad_record', 'roi_data_source',
            'backup_t1', 'backup_t2', 'backup_t3', 'backup_t4',
            'backup_t5', 'backup_t6', 'backup_t7', 'backup_t8',
            'promote_daily_baseline', 'creative_consumption_total',
            'country_targets', 'material_sync',
        ];
        for (const table of tables) {
            const gbResult = await db.execute(sql`UPDATE ${sql.raw(table)} SET country = 'UK' WHERE country = 'GB'`);
            const aeResult = await db.execute(sql`UPDATE ${sql.raw(table)} SET country = 'UAE' WHERE country = 'AE'`);
            changes[`${table}_GB→UK`] = Number((gbResult as { rowCount?: number }).rowCount ?? 0);
            changes[`${table}_AE→UAE`] = Number((aeResult as { rowCount?: number }).rowCount ?? 0);
        }
        return changes;
    }

    // ============================================================
    // 供其他模块调用
    // ============================================================

    async processDailyRecords(
        records: ComputedRecord[], dateRange: { start: string; end: string },
        baselineDate?: string, isCancelled?: () => boolean,
    ): Promise<{ recordsInserted: number }> {
        if (records.length === 0) return { recordsInserted: 0 };
        await this.enrichWithRegistryMatch(records);
        this.assertNotCancelled(isCancelled);
        await this.insertData(records, undefined, isCancelled);
        this.assertNotCancelled(isCancelled);
        await this.backupToTables(dateRange);
        await this.cleanupConfirmedFromTables(dateRange.start);
        this.assertNotCancelled(isCancelled);
        await this.writeDailyBaseline(records, dateRange, baselineDate);
        return { recordsInserted: records.length };
    }

    async processHourlyRecords(
        records: ComputedRecord[], timeSlot: string, isCancelled?: () => boolean,
    ): Promise<{ recordsInserted: number }> {
        if (records.length === 0) throw new BadRequestException(`时报 ${timeSlot} 拉取到 0 条记录`);
        const HOURLY_SLOT_NORMALIZE: Record<string, string> = { '21:00': '22:00', '23:30': '24:00' };
        timeSlot = HOURLY_SLOT_NORMALIZE[timeSlot] ?? timeSlot;
        await this.enrichWithRegistryMatch(records);
        const dateRange = this.getDateRange(records);
        await this.deleteAllPromoteDayData(dateRange);
        const db = await this.ensureDb();
        await db.execute(sql`DELETE FROM hourly_data_record WHERE record_date >= ${dateRange.start} AND record_date <= ${dateRange.end}
      AND time_slot NOT IN ('12:00', '16:00', '18:00', '22:00', '24:00')`);
        this.assertNotCancelled(isCancelled);
        await this.insertData(records, timeSlot, isCancelled);
        this.assertNotCancelled(isCancelled);
        await this.writeHourlyRecord(records, timeSlot);
        return { recordsInserted: records.length };
    }

    // ============================================================
    // 缓存表写入
    // ============================================================

    private async seedAdNameCacheFromMapping(rows: ParsedRow[]): Promise<void> {
        const seeds: AdCacheSeed[] = [];
        for (const r of rows) {
            const adKey = (r.adId || r.creativeId || '').trim();
            if (!adKey || !r.seriesName || r.seriesName === '(tiktok)') continue;
            seeds.push({
                adId: adKey, adName: r.adName || r.creativeName,
                seriesName: r.seriesName, adGroupName: r.adGroupName,
                campaignId: r.campaignId, adGroupId: r.adGroupId,
                videoMaterialId: r.videoMaterialId,
            });
        }
        if (seeds.length === 0) return;
        await this.seedAdNameCache(seeds);
    }

    private async seedAdNameCache(records: AdCacheSeed[]): Promise<void> {
        const byAd = new Map<string, AdCacheSeed>();
        for (const r of records) {
            if (!r.adId || !r.seriesName || r.seriesName === '(tiktok)') continue;
            byAd.set(r.adId, r);
        }
        if (byAd.size === 0) return;
        const db = await this.ensureDb();
        const entries = [...byAd.values()];
        for (let i = 0; i < entries.length; i += 500) {
            const batch = entries.slice(i, i + 500);
            const values = batch.map((r) =>
                `(${sqlVal(r.adId)},${sqlVal(r.adName)},${sqlVal(r.seriesName)},${sqlTrunc(r.adGroupName, 500)},${sqlVal(r.campaignId)},${sqlVal(r.adGroupId)},${sqlVal(r.videoMaterialId)})`,
            ).join(',');
            await db.execute(sql.raw(`INSERT INTO ad_name_cache (ad_id, ad_name, series_name, ad_group_name, campaign_id, ad_group_id, video_id)
        VALUES ${values} ON CONFLICT (ad_id) DO UPDATE SET
          ad_name = EXCLUDED.ad_name, series_name = EXCLUDED.series_name,
          ad_group_name = EXCLUDED.ad_group_name, campaign_id = EXCLUDED.campaign_id,
          ad_group_id = EXCLUDED.ad_group_id, video_id = EXCLUDED.video_id, updated_at = now()`));
        }
    }

    private async seedCampaignAttrCache(rows: ParsedRow[]): Promise<void> {
        const byCampaign = new Map<string, string>();
        for (const r of rows) {
            if (r.campaignId && r.seriesName && r.seriesName !== '(tiktok)' && !byCampaign.has(r.campaignId)) {
                byCampaign.set(r.campaignId, r.seriesName);
            }
        }
        if (byCampaign.size === 0) return;
        const db = await this.ensureDb();
        const entries = [...byCampaign.entries()];
        for (let i = 0; i < entries.length; i += 1000) {
            const batch = entries.slice(i, i + 1000);
            const values = batch.map(([cid, sname]) => `(${sqlVal(cid)},${sqlVal(sname)})`).join(',');
            await db.execute(sql.raw(`INSERT INTO campaign_attr_cache (campaign_id, series_name)
        VALUES ${values} ON CONFLICT (campaign_id) DO UPDATE SET
          series_name = EXCLUDED.series_name, updated_at = now()`));
        }
    }

    async backfillAdIdFromCreative(dateStart?: string, dateEnd?: string, skipLock = false): Promise<{ dates: number; updated: number; cacheSeeded: number }> {
        const run = async () => this.runBackfillAdIdFromCreative(dateStart, dateEnd);
        if (skipLock) return run();
        return this.withExternalDbWriteLock('ad_id 回填', run);
    }

    private async runBackfillAdIdFromCreative(dateStart?: string, dateEnd?: string): Promise<{ dates: number; updated: number; cacheSeeded: number }> {
        const db = await this.ensureDb();
        const dateFilter = dateStart && dateEnd ? sql` AND date_value >= ${dateStart} AND date_value <= ${dateEnd}` : sql``;
        const datesRows = await db.execute(sql`
      SELECT DISTINCT date_value AS d FROM data_source
      WHERE data_source = 'promote' AND COALESCE(ad_id, '') = ''
        AND creative_id ~ '^[0-9]{10,25}$' ${dateFilter}
      ORDER BY d
    `) as unknown as Array<{ d: string }>;
        let updated = 0; let cacheSeeded = 0;
        for (const row of datesRows) {
            const d = row.d;
            const dayResult = await this.withDeadlockRetry(`ad_id 回填 ${d}`, async () => {
                const upd = await db.execute(sql`UPDATE data_source SET ad_id = creative_id
          WHERE data_source = 'promote' AND date_value = ${d}
            AND COALESCE(ad_id, '') = '' AND creative_id ~ '^[0-9]{10,25}$'`);
                const seed = await db.execute(sql`INSERT INTO ad_name_cache (ad_id, ad_name, series_name, ad_group_name, campaign_id, ad_group_id, video_id)
          SELECT DISTINCT ON (ad_id) ad_id,
            COALESCE(NULLIF(ad_name, ''), creative_name), series_name,
            COALESCE(ad_group_name, ''), COALESCE(campaign_id, ''),
            COALESCE(ad_group_id, ''), COALESCE(video_material_id, '')
          FROM data_source
          WHERE data_source = 'promote' AND date_value = ${d}
            AND COALESCE(ad_id, '') <> ''
            AND COALESCE(series_name, '') NOT IN ('', '(tiktok)')
          ORDER BY ad_id, (ad_name IS NULL OR ad_name = '') ASC
          ON CONFLICT (ad_id) DO UPDATE SET
            ad_name = EXCLUDED.ad_name, series_name = EXCLUDED.series_name,
            ad_group_name = EXCLUDED.ad_group_name, campaign_id = EXCLUDED.campaign_id,
            ad_group_id = EXCLUDED.ad_group_id, video_id = EXCLUDED.video_id, updated_at = now()`);
                return {
                    updated: Number((upd as unknown as { count?: number }).count ?? 0),
                    seeded: Number((seed as unknown as { count?: number }).count ?? 0),
                };
            });
            updated += dayResult.updated;
            cacheSeeded += dayResult.seeded;
        }
        return { dates: datesRows.length, updated, cacheSeeded };
    }

    // ============================================================
    // 工具方法
    // ============================================================

    private getModeLabel(mode: UploadMode): string {
        const labels: Record<UploadMode, string> = {
            daily_morning: '日报', hourly_noon: '时报12:00',
            hourly_first: `时报${AFTERNOON_SLOT}`, hourly_second: '时报22:00',
            hourly_third: '时报24:00', zero_cost: '0耗素材', paired: 'Paired双文件',
        };
        return labels[mode] ?? mode;
    }

    private async withExternalDbWriteLock<T>(taskLabel: string, fn: () => Promise<T>): Promise<T> {
        const client = await this.externalDb.getRawClient();
        const conn = await client.reserve();
        let acquired = false;
        try {
            const deadline = Date.now() + 10 * 60 * 1000;
            while (!acquired) {
                const rows = await conn.unsafe('SELECT pg_try_advisory_lock($1) AS acquired', [DataUploadService.EXTERNAL_WRITE_LOCK_KEY]);
                acquired = Boolean(rows[0]?.acquired);
                if (!acquired) {
                    if (Date.now() >= deadline) throw new Error(`${taskLabel}失败：外部库写入锁被占用超过 10 分钟`);
                    await new Promise((r) => setTimeout(r, 3000));
                }
            }
            this.logger.log(`${taskLabel}: 已获取外部库写入锁`);
            return await fn();
        } finally {
            if (acquired) {
                try { await conn.unsafe('SELECT pg_advisory_unlock($1)', [DataUploadService.EXTERNAL_WRITE_LOCK_KEY]); } catch { /* ignore */ }
            }
            conn.release();
        }
    }

    private async withDeadlockRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
        for (let attempt = 0; attempt < 2; attempt++) {
            try { return await fn(); }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                if (msg.includes('deadlock detected') && attempt === 0) {
                    this.logger.warn(`${label} 遇到死锁，2 秒后重试一次`);
                    await new Promise((r) => setTimeout(r, 2000));
                    continue;
                }
                throw err;
            }
        }
        throw new Error('unreachable');
    }
}