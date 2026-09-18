/* eslint-disable */
/**
 * 应用业务表 schema 定义（不受 code_gen 影响）
 * 说明：本项目大部分业务表位于外部 TT-Promote RDB，不在应用库中。
 * code_gen 从应用库拉 schema 时会丢失这些表定义，导致编译失败。
 * 因此业务代码统一从本文件导入表定义，而非自动生成的 schema.ts。
 */
import {sql} from 'drizzle-orm';
import {
    boolean,
    date,
    index,
    integer,
    jsonb,
    numeric,
    pgTable,
    text,
    uniqueIndex,
    uuid,
    varchar,
    customType
} from "drizzle-orm/pg-core"

export const customTimestamptz = customType<{
    data: Date;
    driverData: string;
    config: { precision?: number };
}>({
    dataType(config) {
        const precision = typeof config?.precision !== 'undefined'
            ? ` (${config.precision})`
            : '';
        return `timestamptz${precision}`;
    },
    toDriver(value: Date | string | number) {
        if (value == null) return value as any;
        if (typeof value === 'number') return new Date(value).toISOString();
        if (typeof value === 'string') return value;
        if (value instanceof Date) return value.toISOString();
        throw new Error('Invalid timestamp value');
    },
    fromDriver(value: string | Date): Date {
        if (value instanceof Date) return value;
        return new Date(value);
    },
});

export const userProfile = customType<{
    data: string;
    driverData: string;
}>({
    dataType() {
        return 'user_profile';
    },
    toDriver(value: string) {
        return sql`ROW
        (
        ${value}
        )
        :
        :
        user_profile`;
    },
    fromDriver(value: string) {
        const [userId] = value.slice(1, -1).split(',');
        return userId.trim();
    },
});

export type FileAttachment = {
    bucket_id: string;
    file_path: string;
};

export const fileAttachment = customType<{
    data: FileAttachment;
    driverData: string;
}>({
    dataType() {
        return 'file_attachment';
    },
    toDriver(value: FileAttachment) {
        return sql`ROW
        (
        ${value.bucket_id},
        ${value.file_path}
        )
        :
        :
        file_attachment`;
    },
    fromDriver(value: string): FileAttachment {
        const [bucketId, filePath] = value.slice(1, -1).split(',');
        return {bucket_id: bucketId.trim(), file_path: filePath.trim()};
    },
});

export function escapeLiteral(str: string): string {
    return "'" + str.replace(/'/g, "''") + "'";
}

export const userProfileArray = customType<{
    data: string[];
    driverData: string;
}>({
    dataType() {
        return 'user_profile[]';
    },
    toDriver(value: string[]) {
        if (!value || value.length === 0) {
            return sql`'{}'::user_profile[]`;
        }
        const elements = value.map(id => `ROW(${escapeLiteral(id)})::user_profile`).join(',');
        return sql.raw(`ARRAY[${elements}]::user_profile[]`);
    },
    fromDriver(value: string): string[] {
        if (!value || value === '{}') return [];
        const inner = value.slice(1, -1);
        const matches = inner.match(/\([^)]*\)/g) || [];
        return matches.map(m => m.slice(1, -1).split(',')[0].trim());
    },
});

export const fileAttachmentArray = customType<{
    data: FileAttachment[];
    driverData: string;
}>({
    dataType() {
        return 'file_attachment[]';
    },
    toDriver(value: FileAttachment[]) {
        if (!value || value.length === 0) {
            return sql`'{}'::file_attachment[]`;
        }
        const elements = value.map(f =>
            `ROW(${escapeLiteral(f.bucket_id)},${escapeLiteral(f.file_path)})::file_attachment`
        ).join(',');
        return sql.raw(`ARRAY[${elements}]::file_attachment[]`);
    },
    fromDriver(value: string): FileAttachment[] {
        if (!value || value === '{}') return [];
        const inner = value.slice(1, -1);
        const matches = inner.match(/\([^)]*\)/g) || [];
        return matches.map(m => {
            const [bucketId, filePath] = m.slice(1, -1).split(',');
            return {bucket_id: bucketId.trim(), file_path: filePath.trim()};
        });
    },
});

export const capacityPlanning = pgTable("capacity_planning", {
    id: uuid("id").primaryKey().defaultRandom(),
    week: varchar("week", {length: 100}),
    country: varchar("country", {length: 500}),
    groupMembers: varchar("group_members", {length: 500}),
    targetCount: integer("target_count").default(0),
    sourceType: varchar("source_type", {length: 100}),
    industry: varchar("industry", {length: 100}),
    categoryLevel1: varchar("category_level1", {length: 100}),
    functionName: text("function_name"),
    requirement: text("requirement"),
    painPoint: text("pain_point"),
    categoryLevel2: text("category_level2"),
    categoryLevel3: text("category_level3"),
    weekStatus: varchar("week_status", {length: 100}),
    remark: text("remark"),
    bitableRecordId: varchar("bitable_record_id", {length: 100}),
    createdAt: customTimestamptz("_created_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
    updatedAt: customTimestamptz("_updated_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
});

export const pivotView = pgTable("pivot_view", {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUid: userProfile("owner_uid").notNull(),
    name: varchar("name", {length: 100}).notNull(),
    config: text("config").notNull(),
    createdAt: customTimestamptz("_created_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
    updatedAt: customTimestamptz("_updated_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
    index("idx_pivot_view_user_name").on(table.name),
]);

export const teamMemberMapping = pgTable("team_member_mapping", {
    id: uuid("id").primaryKey().defaultRandom(),
    memberName: varchar("member_name", {length: 100}).notNull(),
    memberId: varchar("member_id", {length: 50}).notNull(),
    codeName: varchar("code_name", {length: 100}).notNull(),
    startDate: date("start_date"),
    endDate: date("end_date"),
    dataSource: varchar("data_source", {length: 50}).notNull().default('promote'),
    matchField: varchar("match_field", {length: 50}).notNull().default('ad_group_name'),
    codePurpose: varchar("code_purpose", {length: 50}).notNull().default('team_cost'),
    groupName: varchar("group_name", {length: 50}),
    specialScopeMarker: text("special_scope_marker"),
    country: text("country"),
    materialType: text("material_type"),
    createdAt: customTimestamptz("_created_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
    updatedAt: customTimestamptz("_updated_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
    index("idx_team_member_mapping_code").on(table.codeName),
    index("idx_team_member_mapping_dates").on(table.startDate, table.endDate),
]);

export const dashboardConfig = pgTable("dashboard_config", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", {length: 100}).notNull(),
    description: text("description"),
    /**
     * @type { chartId: string; x: number; y: number; w: number; h: number }
     */
    layout: jsonb("layout").notNull().default('[]'),
    /**
     * @type { id: string; title: string; chartType: string; dataSource: string; xField?: string; yFields?: string[]; groupField?: string; filters?: Record<string, unknown>; width?: number; height?: number }
     */
    charts: jsonb("charts").notNull().default('[]'),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: customTimestamptz("_created_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
    updatedAt: customTimestamptz("_updated_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
});

export const roiSourceData = pgTable("roi_source_data", {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignNameId: text("campaign_name_id"),
    campaignId: text("campaign_id"),
    campaignName: text("campaign_name"),
    country: text("country"),
    advId: text("adv_id"),
    account: text("account"),
    agent: text("agent"),
    date1: text("date1"),
    date2: text("date2"),
    roi: text("roi"),
    cost: text("cost"),
    gmv: text("gmv"),
    assessment: text("assessment"),
    newOrReactivate: text("new_or_reactivate"),
    direction: text("direction"),
    createdAt: customTimestamptz("_created_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
    updatedAt: customTimestamptz("_updated_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
});


export const feishuBot = pgTable("feishu_bot", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", {length: 100}).notNull(),
    webhookUrl: text("webhook_url").notNull(),
    /**
     * @type { logic: string; conditions: Array<{ field: string; operator: string; value: string | number | string[] }> }
     */
    conditions: jsonb("conditions").notNull().default('{"logic": "and", "conditions": []}'),
    messageTemplate: text("message_template").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    messageTitle: varchar("message_title", {length: 200}).notNull().default('素材预警通知'),
    scheduleEnabled: boolean("schedule_enabled").notNull().default(false),
    scheduleTime: varchar("schedule_time", {length: 10}).notNull().default('09:00'),
    lastScheduledAt: customTimestamptz("last_scheduled_at", {precision: 3}),
    createdAt: customTimestamptz("_created_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
    updatedAt: customTimestamptz("_updated_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
});

export const bitableDataBackup = pgTable("bitable_data_backup", {
    id: uuid("id").primaryKey().defaultRandom(),
    pluginInstanceId: varchar("plugin_instance_id", {length: 200}).notNull(),
    country: varchar("country", {length: 100}).notNull(),
    bitableRecordId: varchar("bitable_record_id", {length: 200}).notNull(),
    /**
     * @type { [key: string]: unknown }
     */
    rawData: jsonb("raw_data").notNull(),
    createdAt: customTimestamptz("_created_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
    updatedAt: customTimestamptz("_updated_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
    uniqueIndex("idx_bitable_backup_plugin_record").on(table.pluginInstanceId, table.bitableRecordId),
    index("idx_bitable_backup_country").on(table.country),
]);

export const creativeAssetRegistry = pgTable("creative_asset_registry", {
    id: uuid("id").primaryKey().defaultRandom(),
    identityCardId: varchar("identity_card_id", {length: 200}),
    director: text("director"),
    functionName: text("function_name"),
    requirement: text("requirement"),
    painPoint: text("pain_point"),
    molecule: text("molecule"),
    productionType: varchar("production_type", {length: 100}),
    hookType: varchar("hook_type", {length: 100}),
    openingScene: text("opening_scene"),
    validElements: text("valid_elements"),
    validLocations: text("valid_locations"),
    scriptTags: text("script_tags"),
    sourceTableId: varchar("source_table_id", {length: 100}),
    bitableRecordId: varchar("bitable_record_id", {length: 100}),
    country: varchar("country", {length: 50}),
    sourceTable: varchar("source_table", {length: 100}),
    lateEditor: text("late_editor"),
    cachedCost: numeric("cached_cost"),
    cachedClicks: numeric("cached_clicks"),
    cachedImpressions: numeric("cached_impressions"),
    cachedConversions: numeric("cached_conversions"),
    cachedNewUserActivated: numeric("cached_new_user_activated"),
    cachedPlay2s: numeric("cached_play_2s"),
    cachedPlayCount: numeric("cached_play_count"),
    cachedPlayComplete: numeric("cached_play_complete"),
    cachedAvgVideoPlayDuration: numeric("cached_avg_video_play_duration"),
    productionStatus: varchar("production_status", {length: 100}),
    newOrActive: varchar("new_or_active", {length: 100}),
    materialType: varchar("material_type", {length: 100}),
    productionDate: varchar("production_date", {length: 50}),
    auditStatus: varchar("audit_status", {length: 50}),
    finalName: text("final_name"),
    createdAt: customTimestamptz("_created_at", {precision: 6}).notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: userProfile("_created_by"),
    updatedAt: customTimestamptz("_updated_at", {precision: 6}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: userProfile("_updated_by"),
}, (table) => [
    index("idx_registry_identity_card_id").on(table.identityCardId),
    index("idx_registry_source_table").on(table.sourceTableId),
    index("idx_registry_country").on(table.country),
    uniqueIndex("idx_registry_source_bitable_record").on(table.sourceTableId, table.bitableRecordId),
]);

export const creativeAssetsExport = pgTable("creative_assets_export", {
    id: uuid("id").primaryKey().defaultRandom(),
    timeRange: varchar("time_range", {length: 200}),
    creativeName: varchar("creative_name", {length: 500}),
    createdTime: varchar("created_time", {length: 100}),
    creativeSource: varchar("creative_source", {length: 200}),
    country: varchar("country", {length: 100}),
    placement: varchar("placement", {length: 200}),
    relatedAdCount: integer("related_ad_count").default(0),
    cost: numeric("cost").default('0'),
    cpm: numeric("cpm").default('0'),
    impressions: integer("impressions").default(0),
    clicksLandingPage: integer("clicks_landing_page").default(0),
    ctrLandingPage: numeric("ctr_landing_page").default('0'),
    cleanedMaterialName: varchar("cleaned_material_name", {length: 500}),
    materialDate: varchar("material_date", {length: 100}),
    zeroCostFlag: varchar("zero_cost_flag", {length: 50}),
    createdAt: customTimestamptz("_created_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
    updatedAt: customTimestamptz("_updated_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
    index("idx_creative_assets_export_time_range").on(table.timeRange),
    index("idx_creative_assets_export_country").on(table.country),
    index("idx_creative_assets_export_placement").on(table.placement),
    index("idx_creative_assets_export_cleaned_name").on(table.cleanedMaterialName),
]);

export const ncaSourceData = pgTable("nca_source_data", {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceDate: varchar("source_date", {length: 50}).notNull(),
    campaignId: varchar("campaign_id", {length: 200}),
    reportingAdId: varchar("reporting_ad_id", {length: 200}),
    reportingTemplateCreativeId: varchar("reporting_template_creative_id", {length: 200}),
    advertiserId: varchar("advertiser_id", {length: 200}),
    ncaCpa: numeric("nca_cpa").default('0'),
    newUserActivated: integer("new_user_activated").default(0),
    paidAdCost: numeric("paid_ad_cost").default('0'),
    campaignName: varchar("campaign_name", {length: 500}),
    createdAt: customTimestamptz("_created_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
    updatedAt: customTimestamptz("_updated_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
    index("idx_nca_source_data_source_date").on(table.sourceDate),
    index("idx_nca_source_data_campaign_id").on(table.campaignId),
    index("idx_nca_source_data_advertiser_id").on(table.advertiserId),
]);

export const tableView = pgTable("table_view", {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUid: userProfile("owner_uid").notNull(),
    name: varchar("name", {length: 100}).notNull().unique(),
    fields: text("fields").notNull(),
    createdAt: customTimestamptz("_created_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
    updatedAt: customTimestamptz("_updated_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
    uniqueIndex("idx_table_view_user_name").on(table.name),
]);

export const userPreferences = pgTable("user_preferences", {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUid: userProfile("owner_uid").notNull(),
    preferenceKey: varchar("preference_key", {length: 100}).notNull().unique(),
    preferenceValue: text("preference_value"),
    createdAt: customTimestamptz("_created_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
    updatedAt: customTimestamptz("_updated_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
    uniqueIndex("idx_user_preferences_user_key").on(table.preferenceKey),
]);

export const dataSourceDetail = pgTable("data_source_detail", {
    id: uuid("id").primaryKey().defaultRandom(),
    dataSourceId: uuid("data_source_id").notNull(),
    cpaOriginal: numeric("cpa_original"),
    cpmOriginal: numeric("cpm_original"),
    playCount: integer("play_count").default(0),
    play2s: integer("play_2s").default(0),
    play5s: integer("play_5s").default(0),
    playComplete: integer("play_complete").default(0),
    materialNameClean: varchar("material_name_clean", {length: 500}),
    audienceType: varchar("audience_type", {length: 100}),
    bcType: varchar("bc_type", {length: 50}),
    videoCompleteRate: numeric("video_complete_rate"),
    avgVideoPlayDuration: numeric("avg_video_play_duration"),
    dataSource: varchar("data_source", {length: 50}).notNull().default('promote'),
    createdAt: customTimestamptz("_created_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
    updatedAt: customTimestamptz("_updated_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
    index("idx_data_source_detail_data_source_id").on(table.dataSourceId),
    index("idx_data_source_detail_source").on(table.dataSource),
]);

export const dataSource = pgTable("data_source", {
    id: uuid("id").primaryKey().defaultRandom(),
    seriesName: varchar("series_name", {length: 500}).notNull(),
    recordDate: varchar("record_date", {length: 50}).notNull(),
    adGroupName: varchar("ad_group_name", {length: 500}),
    creativeName: varchar("creative_name", {length: 500}),
    cost: numeric("cost").notNull().default('0'),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    conversions: integer("conversions").notNull().default(0),
    country: varchar("country", {length: 100}),
    materialType: varchar("material_type", {length: 100}),
    placement: varchar("placement", {length: 100}),
    agent: varchar("agent", {length: 100}),
    dateValue: varchar("date_value", {length: 20}),
    materialCategory: varchar("material_category", {length: 100}),
    newOrActive: varchar("new_or_active", {length: 50}),
    adGroupId: varchar("ad_group_id", {length: 200}),
    adName: varchar("ad_name", {length: 500}),
    adId: varchar("ad_id", {length: 200}),
    creativeId: varchar("creative_id", {length: 200}),
    videoMaterialId: varchar("video_material_id", {length: 200}),
    cleanedMaterialName: varchar("cleaned_material_name", {length: 500}),
    newUserActivated: integer("new_user_activated").default(0),
    placer: varchar("placer", {length: 100}),
    bidType: varchar("bid_type", {length: 50}),
    materialDirection: varchar("material_direction", {length: 100}),
    bcDirection: varchar("bc_direction", {length: 50}),
    materialDate: varchar("material_date", {length: 50}),
    secondaryCategory: varchar("secondary_category", {length: 100}),
    tertiaryCategory: varchar("tertiary_category", {length: 100}),
    creativeIdentityId: varchar("creative_identity_id", {length: 200}),
    dataSource: varchar("data_source", {length: 50}).notNull().default('promote'),
    campaignId: varchar("campaign_id", {length: 200}),
    createdAt: customTimestamptz("_created_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
    updatedAt: customTimestamptz("_updated_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
    index("idx_data_source_date_value").on(table.dateValue),
    index("idx_data_source_country").on(table.country),
    index("idx_data_source_material_type").on(table.materialType),
    index("idx_data_source_agent").on(table.agent),
    index("idx_data_source_placement").on(table.placement),
    index("idx_data_source_record_date").on(table.recordDate),
    uniqueIndex("idx_data_source_dedup").on(table.dateValue, table.adGroupId, table.creativeId, table.videoMaterialId),
    index("idx_data_source_ad_date_query").on(table.adId, table.dateValue),
    index("idx_data_source_cleaned_material_name").on(table.cleanedMaterialName),
    index("idx_data_source_source").on(table.dataSource),
]);

export const uploadRecord = pgTable("upload_record", {
    id: uuid("id").primaryKey().defaultRandom(),
    fileName: varchar("file_name", {length: 500}).notNull(),
    filePath: text("file_path"),
    status: varchar("status", {length: 20}).notNull().default('processing'),
    totalRows: integer("total_rows").default(0),
    validRows: integer("valid_rows").default(0),
    errorMessage: text("error_message"),
    dataDateStart: varchar("data_date_start", {length: 20}),
    dataDateEnd: varchar("data_date_end", {length: 20}),
    processedAt: varchar("processed_at", {length: 50}),
    createdAt: customTimestamptz("_created_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
    updatedAt: customTimestamptz("_updated_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
    index("idx_upload_record_status").on(table.status),
]);

export const dataBackup = pgTable("data_backup", {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: varchar("batch_id", {length: 100}).notNull(),
    backupDate: varchar("backup_date", {length: 20}).notNull(),
    dataDateStart: varchar("data_date_start", {length: 20}),
    dataDateEnd: varchar("data_date_end", {length: 20}),
    rowCount: integer("row_count").default(0),
    status: varchar("status", {length: 20}).notNull().default('active'),
    dataSnapshot: text("data_snapshot"),
    createdAt: customTimestamptz("_created_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
    updatedAt: customTimestamptz("_updated_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
    index("idx_data_backup_batch_id").on(table.batchId),
    index("idx_data_backup_status").on(table.status),
    index("idx_data_backup_status_date_range").on(table.status, table.dataDateStart, table.dataDateEnd),
]);

export const adRecordDetail = pgTable("ad_record_detail", {
    id: uuid("id").primaryKey().defaultRandom(),
    adRecordId: uuid("ad_record_id").notNull(),
    cpaOriginal: numeric("cpa_original"),
    cpmOriginal: numeric("cpm_original"),
    playCount: integer("play_count").default(0),
    play2s: integer("play_2s").default(0),
    play5s: integer("play_5s").default(0),
    playComplete: integer("play_complete").default(0),
    materialNameClean: varchar("material_name_clean", {length: 500}),
    audienceType: varchar("audience_type", {length: 100}),
    bcType: varchar("bc_type", {length: 50}),
    videoCompleteRate: numeric("video_complete_rate"),
    avgVideoPlayDuration: numeric("avg_video_play_duration"),
    createdAt: customTimestamptz("_created_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
    updatedAt: customTimestamptz("_updated_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
    index("idx_ad_record_detail_ad_record_id").on(table.adRecordId),
]);

export const adRecord = pgTable("ad_record", {
    id: uuid("id").primaryKey().defaultRandom(),
    seriesName: varchar("series_name", {length: 500}).notNull(),
    recordDate: varchar("record_date", {length: 50}).notNull(),
    adGroupName: varchar("ad_group_name", {length: 500}),
    creativeName: varchar("creative_name", {length: 500}),
    cost: numeric("cost").notNull().default('0'),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    conversions: integer("conversions").notNull().default(0),
    country: varchar("country", {length: 100}),
    materialType: varchar("material_type", {length: 100}),
    placement: varchar("placement", {length: 100}),
    agent: varchar("agent", {length: 100}),
    dateValue: varchar("date_value", {length: 20}),
    materialCategory: varchar("material_category", {length: 100}),
    newOrActive: varchar("new_or_active", {length: 50}),
    accountName: varchar("account_name", {length: 500}),
    accountId: varchar("account_id", {length: 200}),
    seriesId: varchar("series_id", {length: 200}),
    adGroupId: varchar("ad_group_id", {length: 200}),
    adName: varchar("ad_name", {length: 500}),
    adId: varchar("ad_id", {length: 200}),
    creativeId: varchar("creative_id", {length: 200}),
    videoMaterialId: varchar("video_material_id", {length: 200}),
    createdAt: customTimestamptz("_created_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
    updatedAt: customTimestamptz("_updated_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
    index("idx_ad_record_date_value").on(table.dateValue),
    index("idx_ad_record_country").on(table.country),
    index("idx_ad_record_material_type").on(table.materialType),
    index("idx_ad_record_agent").on(table.agent),
    index("idx_ad_record_placement").on(table.placement),
    index("idx_ad_record_record_date").on(table.recordDate),
]);

export const appFavorite = pgTable("app_favorite", {
    id: uuid("id").primaryKey().defaultRandom(),
    appId: varchar("app_id", {length: 255}).notNull().unique(),
    ownerUid: userProfile("owner_uid").notNull(),
    createdAt: customTimestamptz("_created_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
    updatedAt: customTimestamptz("_updated_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
    index("idx_app_favorite_app_id").on(table.appId),
    uniqueIndex("idx_app_favorite_unique").on(table.appId),
]);

export const template = pgTable("template", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", {length: 255}).notNull(),
    category: varchar("category", {length: 50}).notNull().default('tool'),
    description: text("description"),
    coverImage: text("cover_image"),
    structure: text("structure"),
    usageCount: integer("usage_count").notNull().default(0),
    isCustom: boolean("is_custom").notNull().default(false),
    sourceAppId: varchar("source_app_id", {length: 255}),
    creator: userProfile("creator"),
    createdAt: customTimestamptz("_created_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
    updatedAt: customTimestamptz("_updated_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
    index("idx_template_category").on(table.category),
    index("idx_template_is_custom").on(table.isCustom),
]);

export const appApiStat = pgTable("app_api_stat", {
    id: uuid("id").primaryKey().defaultRandom(),
    appId: varchar("app_id", {length: 255}).notNull(),
    statDate: varchar("stat_date", {length: 20}).notNull(),
    callCount: integer("call_count").notNull().default(0),
    avgResponseTime: integer("avg_response_time").notNull().default(0),
    createdAt: customTimestamptz("_created_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
    updatedAt: customTimestamptz("_updated_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
    index("idx_app_api_stat_app_id").on(table.appId),
]);

export const appVisitStat = pgTable("app_visit_stat", {
    id: uuid("id").primaryKey().defaultRandom(),
    appId: varchar("app_id", {length: 255}).notNull(),
    statDate: varchar("stat_date", {length: 20}).notNull(),
    visitCount: integer("visit_count").notNull().default(0),
    createdAt: customTimestamptz("_created_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
    updatedAt: customTimestamptz("_updated_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
    index("idx_app_visit_stat_app_id").on(table.appId),
]);

export const appFeedback = pgTable("app_feedback", {
    id: uuid("id").primaryKey().defaultRandom(),
    appId: varchar("app_id", {length: 255}).notNull(),
    rating: integer("rating").notNull().default(5),
    comment: text("comment"),
    submitter: userProfile("submitter"),
    createdAt: customTimestamptz("_created_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
    updatedAt: customTimestamptz("_updated_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
    index("idx_app_feedback_app_id").on(table.appId),
]);

export const docVersion = pgTable("doc_version", {
    id: uuid("id").primaryKey().defaultRandom(),
    appId: varchar("app_id", {length: 255}).notNull(),
    versionNumber: integer("version_number").notNull(),
    content: text("content"),
    changeSummary: text("change_summary"),
    editor: userProfile("editor"),
    createdAt: customTimestamptz("_created_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
    updatedAt: customTimestamptz("_updated_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
    index("idx_doc_version_app_id").on(table.appId),
]);

export const appDocument = pgTable("app_document", {
    id: uuid("id").primaryKey().defaultRandom(),
    appId: varchar("app_id", {length: 255}).notNull(),
    content: text("content"),
    currentVersion: integer("current_version").notNull().default(0),
    lastEditor: userProfile("last_editor"),
    createdAt: customTimestamptz("_created_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
    updatedAt: customTimestamptz("_updated_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
    index("idx_app_document_app_id").on(table.appId),
]);

export const appProject = pgTable("app_project", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", {length: 255}).notNull(),
    type: varchar("type", {length: 50}).notNull().default('tool'),
    description: text("description"),
    status: varchar("status", {length: 50}).notNull().default('draft'),
    thumbnail: text("thumbnail"),
    config: text("config"),
    owner: userProfile("owner"),
    createdAt: customTimestamptz("_created_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
    updatedAt: customTimestamptz("_updated_at", {precision: 3}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
    index("idx_app_project_status").on(table.status),
    index("idx_app_project_type").on(table.type),
]);

export const adRecordTable = adRecord;
export const adRecordDetailTable = adRecordDetail;
export const appApiStatTable = appApiStat;
export const appDocumentTable = appDocument;
export const appFavoriteTable = appFavorite;
export const appFeedbackTable = appFeedback;
export const appProjectTable = appProject;
export const appVisitStatTable = appVisitStat;
export const bitableDataBackupTable = bitableDataBackup;
export const capacityPlanningTable = capacityPlanning;
export const creativeAssetRegistryTable = creativeAssetRegistry;
export const creativeAssetsExportTable = creativeAssetsExport;
export const dashboardConfigTable = dashboardConfig;
export const dataBackupTable = dataBackup;
export const dataSourceTable = dataSource;
export const dataSourceDetailTable = dataSourceDetail;
export const docVersionTable = docVersion;
export const feishuBotTable = feishuBot;
export const ncaSourceDataTable = ncaSourceData;
export const pivotViewTable = pivotView;
export const roiSourceDataTable = roiSourceData;
export const tableViewTable = tableView;
export const teamMemberMappingTable = teamMemberMapping;
export const templateTable = template;
export const uploadRecordTable = uploadRecord;
export const userPreferencesTable = userPreferences;
