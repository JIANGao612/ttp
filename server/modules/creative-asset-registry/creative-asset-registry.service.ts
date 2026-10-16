/**
 * 内审表（creative_asset_registry）查询服务
 *
 * 表位置：外部库 TT-Promote
 * 数据来源：妙搭侧定时同步（本项目不负责同步，只读）
 * 主要功能：按国家、周次、审核状态等维度查询内审素材列表
 */
import {Injectable, Logger} from '@nestjs/common';
import {ExternalDbService} from '../external-db/external-db.service';
import {sql} from 'drizzle-orm';
import type {PostgresJsDatabase} from 'drizzle-orm/postgres-js';

export interface RegistryListQuery {
    page?: number;
    pageSize?: number;
    country?: string;
    week?: string;
    auditStatus?: string;
    productionStatus?: string;
    keyword?: string;
    sortField?: string;
    sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class CreativeAssetRegistryService {
    private readonly logger = new Logger(CreativeAssetRegistryService.name);
    private _db: PostgresJsDatabase | null = null;

    constructor(private readonly externalDb: ExternalDbService) {
    }

    private async ensureDb(): Promise<PostgresJsDatabase> {
        if (!this._db) {
            this._db = await this.externalDb.getDb();
        }
        return this._db;
    }

    /**
     * 查询内审表列表（分页）
     *
     * 说明：字段名以数据库真实列名为准（snake_case），前端展示时再转成 camelCase
     */
    async list(query: RegistryListQuery) {
        const db = await this.ensureDb();
        const page = Math.max(1, query.page ?? 1);
        const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 50));
        const offset = (page - 1) * pageSize;

        // 1. 构建 WHERE 条件
        const conditions: ReturnType<typeof sql>[] = [sql`1=1`];

        if (query.country) {
            conditions.push(sql`country
            =
            ${query.country}`);
        }
        if (query.week) {
            conditions.push(sql`week
            =
            ${query.week}`);
        }
        if (query.auditStatus) {
            conditions.push(sql`audit_status
            =
            ${query.auditStatus}`);
        }
        if (query.productionStatus) {
            conditions.push(sql`production_status
            =
            ${query.productionStatus}`);
        }
        if (query.keyword) {
            const kw = `%${query.keyword}%`;
            conditions.push(
                sql`(final_name ILIKE ${kw} OR initial_name ILIKE ${kw} OR identity_card_id ILIKE ${kw})`,
            );
        }

        const whereClause = sql.join(conditions, sql` AND `);

        // 2. 允许排序的字段白名单（防止 SQL 注入）
        const allowedSort: Record<string, string> = {
            materialDate: 'material_date',
            cost: 'cached_cost',
            clicks: 'cached_clicks',
            impressions: 'cached_impressions',
            conversions: 'cached_conversions',
            week: 'week',
            createdAt: '_created_at',
        };
        const sortColumn = allowedSort[query.sortField ?? ''] ?? 'material_date';
        const sortDir = query.sortOrder === 'asc' ? 'ASC' : 'DESC';

        // 3. 查总数
        const countResult = (await db.execute(sql`
            SELECT COUNT(*) ::int AS cnt
            FROM creative_asset_registry
            WHERE ${whereClause}
        `)) as unknown as Array<{ cnt: number }>;
        const total = countResult[0]?.cnt ?? 0;

        // 4. 查数据
        const rows = (await db.execute(sql`
            SELECT id,
                   identity_card_id,
                   initial_name,
                   final_name,
                   director,
                   function_name,
                   requirement,
                   pain_point,
                   molecule,
                   production_type,
                   hook_type,
                   opening_scene,
                   valid_elements,
                   valid_locations,
                   script_tags,
                   country,
                   source_table_id,
                   bitable_record_id,
                   new_or_active,
                   material_type,
                   production_status,
                   audit_status,
                   material_date,
                   week,
                   team_leader,
                   cached_cost,
                   cached_clicks,
                   cached_impressions,
                   cached_conversions,
                   cached_play_2s,
                   cached_play_count,
                   cached_play_complete,
                   cached_avg_video_play_duration,
                   cached_first_cost_date,
                   cached_investment_days,
                   _created_at,
                   _updated_at
            FROM creative_asset_registry
            WHERE ${whereClause}
            ORDER BY ${sql.raw(sortColumn)} ${sql.raw(sortDir)} NULLS LAST
      LIMIT ${pageSize}
            OFFSET ${offset}
        `)) as unknown as Array<Record<string, unknown>>;

        const items = rows.map((r) => this.mapRow(r));
        return {items, total, page, pageSize};
    }

    /** 数据库行（snake_case）转前端对象（camelCase） */
    private mapRow(r: Record<string, unknown>) {
        return {
            id: String(r.id ?? ''),
            identityCardId: String(r.identity_card_id ?? ''),
            initialName: String(r.initial_name ?? ''),
            finalName: String(r.final_name ?? ''),
            director: String(r.director ?? ''),
            functionName: String(r.function_name ?? ''),
            requirement: String(r.requirement ?? ''),
            painPoint: String(r.pain_point ?? ''),
            molecule: String(r.molecule ?? ''),
            productionType: String(r.production_type ?? ''),
            hookType: String(r.hook_type ?? ''),
            openingScene: String(r.opening_scene ?? ''),
            validElements: String(r.valid_elements ?? ''),
            validLocations: String(r.valid_locations ?? ''),
            scriptTags: String(r.script_tags ?? ''),
            country: String(r.country ?? ''),
            sourceTableId: String(r.source_table_id ?? ''),
            bitableRecordId: String(r.bitable_record_id ?? ''),
            newOrActive: String(r.new_or_active ?? ''),
            materialType: String(r.material_type ?? ''),
            productionStatus: String(r.production_status ?? ''),
            auditStatus: String(r.audit_status ?? ''),
            materialDate: String(r.material_date ?? ''),
            week: String(r.week ?? ''),
            teamLeader: String(r.team_leader ?? ''),
            cost: Number(r.cached_cost ?? 0),
            clicks: Number(r.cached_clicks ?? 0),
            impressions: Number(r.cached_impressions ?? 0),
            conversions: Number(r.cached_conversions ?? 0),
            play2s: Number(r.cached_play_2s ?? 0),
            playCount: Number(r.cached_play_count ?? 0),
            playComplete: Number(r.cached_play_complete ?? 0),
            avgVideoPlayDuration: Number(r.cached_avg_video_play_duration ?? 0),
            firstCostDate: String(r.cached_first_cost_date ?? ''),
            investmentDays: Number(r.cached_investment_days ?? 0),
            createdAt: String(r._created_at ?? ''),
            updatedAt: String(r._updated_at ?? ''),
        };
    }

    /** 筛选项（去重后的国家/周次/审核状态列表） */
    async getFilterOptions() {
        const db = await this.ensureDb();
        const [countries, weeks, auditStatuses, productionStatuses] = await Promise.all([
            db.execute(sql`SELECT DISTINCT country
                           FROM creative_asset_registry
                           WHERE country IS NOT NULL
                             AND country != ''
                           ORDER BY country`) as unknown as Promise<Array<{ country: string }>>,
            db.execute(sql`SELECT DISTINCT week
                           FROM creative_asset_registry
                           WHERE week IS NOT NULL
                             AND week != ''
                           ORDER BY week DESC LIMIT 20`) as unknown as Promise<Array<{ week: string }>>,
            db.execute(sql`SELECT DISTINCT audit_status
                           FROM creative_asset_registry
                           WHERE audit_status IS NOT NULL
                             AND audit_status != ''
                           ORDER BY audit_status`) as unknown as Promise<Array<{ audit_status: string }>>,
            db.execute(sql`SELECT DISTINCT production_status
                           FROM creative_asset_registry
                           WHERE production_status IS NOT NULL
                             AND production_status != ''
                           ORDER BY production_status`) as unknown as Promise<Array<{ production_status: string }>>,
        ]);
        return {
            countries: countries.map((r) => r.country).filter(Boolean),
            weeks: weeks.map((r) => r.week).filter(Boolean),
            auditStatuses: auditStatuses.map((r) => r.audit_status).filter(Boolean),
            productionStatuses: productionStatuses.map((r) => r.production_status).filter(Boolean),
        };
    }
}