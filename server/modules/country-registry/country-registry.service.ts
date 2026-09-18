import {Injectable, Logger} from '@nestjs/common';
import {ExternalDbService} from '../external-db/external-db.service';
import {sql} from 'drizzle-orm';
import type {PostgresJsDatabase} from 'drizzle-orm/postgres-js';
import type {
    CountryRegistryRow,
    CountryRegistryListResponse,
    CountryRegistryCreateDto,
    CountryRegistryUpdateDto,
    CountryRegistryVisibilityItem,
    CountryRegistryVisibilityResponse,
    CountryRegistryBatchImportItem,
    CountryRegistryBatchImportResponse,
    CountryRegistryForceResetResponse,
} from '@shared/api.interface';

const ENSURE_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS country_registry
    (
        id
        UUID
        PRIMARY
        KEY
        DEFAULT
        gen_random_uuid
    (
    ),
        country VARCHAR
    (
        200
    ) NOT NULL,
        region VARCHAR
    (
        100
    ) NOT NULL,
        assessment_metric VARCHAR
    (
        200
    ) NOT NULL DEFAULT '',
        assessment_value VARCHAR
    (
        200
    ) NOT NULL DEFAULT '',
        status VARCHAR
    (
        20
    ) NOT NULL DEFAULT '投放中',
        show_in_reports BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW
    (
    ),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW
    (
    ),
        updated_by VARCHAR
    (
        200
    )
        );
`;

const DQ = String.fromCharCode(36) + String.fromCharCode(36);

const ALTER_COLUMNS_SQL = [
    "ALTER TABLE country_registry ALTER COLUMN assessment_metric SET DEFAULT ''",
    "ALTER TABLE country_registry ALTER COLUMN assessment_value SET DEFAULT ''",
    `DO ${DQ} BEGIN
    ALTER TABLE country_registry ADD COLUMN IF NOT EXISTS show_in_reports BOOLEAN NOT NULL DEFAULT false;
  EXCEPTION WHEN duplicate_column THEN NULL;
  END ${DQ}`,
    `DO ${DQ} BEGIN
    ALTER TABLE country_registry ADD COLUMN IF NOT EXISTS country_name VARCHAR(200) NOT NULL DEFAULT '';
  EXCEPTION WHEN duplicate_column THEN NULL;
  END ${DQ}`,
    `DO ${DQ} BEGIN
    ALTER TABLE country_registry ADD CONSTRAINT uq_country_registry_country UNIQUE (country);
  EXCEPTION WHEN duplicate_table THEN NULL;
  END ${DQ}`,
    `DO ${DQ} BEGIN
    ALTER TABLE country_registry ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 9999;
  EXCEPTION WHEN duplicate_column THEN NULL;
  END ${DQ}`,
    `DO ${DQ} BEGIN
    ALTER TABLE country_registry ADD COLUMN IF NOT EXISTS region_color VARCHAR(20) NOT NULL DEFAULT '';
  EXCEPTION WHEN duplicate_column THEN NULL;
  END ${DQ}`,
].join(';\n') + ';';

const ENSURE_USER_DISPLAY_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS user_country_display_settings
    (
        id
        UUID
        PRIMARY
        KEY
        DEFAULT
        gen_random_uuid
    (
    ),
        user_id VARCHAR
    (
        200
    ) NOT NULL,
        country_code VARCHAR
    (
        10
    ) NOT NULL,
        show BOOLEAN NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW
    (
    ),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW
    (
    ),
        CONSTRAINT uq_user_country_display UNIQUE
    (
        user_id,
        country_code
    )
        );
`;

const COUNTRY_REGION_MAP: Record<string, string> = {
    'US': 'NA', 'CA': 'NA',
    'UK': 'EU', 'ES': 'EU', 'IT': 'EU', 'PL': 'EU',
    'NL': 'EU', 'BE': 'EU', 'PT': 'EU', 'RO': 'EU',
    'DE': 'EU', 'FR': 'EU',
    'AR': 'LATAM', 'MX': 'LATAM', 'BR': 'LATAM', 'CO': 'LATAM', 'CL': 'LATAM',
    'AU': 'APAC', 'MY': 'APAC', 'SG': 'APAC', 'ID': 'APAC',
    'TH': 'APAC', 'VN': 'APAC', 'JP': 'APAC', 'KR': 'APAC', 'PH': 'APAC',
    'BD': 'APAC', 'PK': 'APAC', 'NZ': 'APAC', 'KZ': 'APAC', 'KH': 'APAC',
    'EG': 'EMEA (METAP)', 'ZA': 'EMEA (METAP)', 'NG': 'EMEA (METAP)', 'MA': 'EMEA (METAP)',
    'IL': 'EMEA (METAP)', 'TR': 'EMEA (METAP)', 'SA': 'EMEA (METAP)',
    'UAE': 'EMEA (METAP)',
};

const COUNTRY_NAME_MAP: Record<string, string> = {
    'US': '美国', 'CA': '加拿大',
    'UK': '英国', 'ES': '西班牙', 'IT': '意大利', 'PL': '波兰',
    'NL': '荷兰', 'BE': '比利时', 'PT': '葡萄牙', 'RO': '罗马尼亚',
    'DE': '德国', 'FR': '法国',
    'AR': '阿根廷', 'MX': '墨西哥', 'BR': '巴西', 'CO': '哥伦比亚', 'CL': '智利',
    'AU': '澳大利亚', 'MY': '马来西亚', 'SG': '新加坡', 'ID': '印尼',
    'TH': '泰国', 'VN': '越南', 'JP': '日本', 'KR': '韩国', 'PH': '菲律宾',
    'BD': '孟加拉国', 'PK': '巴基斯坦', 'NZ': '新西兰', 'KZ': '哈萨克斯坦', 'KH': '柬埔寨',
    'EG': '埃及', 'ZA': '南非', 'NG': '尼日利亚', 'MA': '摩洛哥',
    'IL': '以色列', 'TR': '土耳其', 'SA': '沙特阿拉伯', 'UAE': '阿联酋',
};

@Injectable()
export class CountryRegistryService {
    private readonly logger = new Logger(CountryRegistryService.name);
    private db: PostgresJsDatabase | null = null;

    constructor(private readonly externalDb: ExternalDbService) {
    }

    private async ensureDb(): Promise<PostgresJsDatabase> {
        if (this.db) return this.db;
        const db = await this.externalDb.getDb();
        await db.execute(sql.raw(ENSURE_TABLE_SQL));
        await db.execute(sql.raw(ALTER_COLUMNS_SQL));
        await db.execute(sql.raw(ENSURE_USER_DISPLAY_TABLE_SQL));
        await this.backfillCountryNames(db);     // ← 用局部变量 db
        await this.backfillSortOrder(db);        // ← 用局部变量 db
        await this.backfillRegionColors(db);     // ← 用局部变量 db
        await this.seedIfEmpty(db);              // ← 用局部变量 db
        this.db = db;                            // ← 最后再赋值给 this.db
        this.logger.log('country_registry tables ensured');
        return db;
    }

    /** 首次启动时，如果 country_registry 表为空，就自动填充种子数据 */
    private async seedIfEmpty(db: PostgresJsDatabase): Promise<void> {
        const countResult = await db.execute(
            sql`SELECT COUNT(*) ::int AS count
                FROM country_registry`,
        );
        const count = Number((countResult as Array<Record<string, unknown>>)[0]?.count ?? 0);
        if (count > 0) return;

        this.logger.log('country_registry is empty, seeding initial data...');

        const codes = Object.keys(COUNTRY_NAME_MAP);
        for (let i = 0; i < codes.length; i++) {
            const code = codes[i];
            const name = COUNTRY_NAME_MAP[code];
            const region = COUNTRY_REGION_MAP[code] ?? '其他';
            const regionColor =
                region === 'NA' ? '#bfdbfe'
                    : region === 'EU' ? '#a3e635'
                        : region === 'LATAM' ? '#fef3c7'
                            : region === 'APAC' ? '#dcfce7'
                                : region === 'EMEA (METAP)' ? '#fde68a'
                                    : '#e5e7eb';

            await db.execute(sql`
                INSERT INTO country_registry (country, country_name, region, region_color, sort_order, status,
                                              show_in_reports)
                VALUES (${code}, ${name}, ${region}, ${regionColor}, ${i + 1}, '投放中',
                        true) ON CONFLICT (country) DO NOTHING
            `);
        }

        this.logger.log(`Seeded ${codes.length} countries`);
    }

    private async backfillCountryNames(db: PostgresJsDatabase): Promise<void> {
        const entries = Object.entries(COUNTRY_NAME_MAP);
        if (entries.length === 0) return;
        const caseClauses = entries
            .map(([code, name]) => `WHEN '${code.replace(/'/g, "''")}' THEN '${name.replace(/'/g, "''")}'`)
            .join(' ');
        const codesList = entries.map(([code]) => `'${code.replace(/'/g, "''")}'`).join(', ');
        await db.execute(sql.raw(`
            UPDATE country_registry
            SET country_name = CASE country ${caseClauses} ELSE country_name END
            WHERE country IN (${codesList}) AND (country_name IS NULL OR country_name = '')
        `));
    }

    private async backfillSortOrder(db: PostgresJsDatabase): Promise<void> {
        const codes = Object.keys(COUNTRY_NAME_MAP);
        if (codes.length === 0) return;
        const caseClauses = codes
            .map((code, idx) => `WHEN '${code.replace(/'/g, "''")}' THEN ${idx + 1}`)
            .join(' ');
        const codesList = codes.map((c) => `'${c.replace(/'/g, "''")}'`).join(', ');
        await db.execute(sql.raw(`
            UPDATE country_registry
            SET sort_order = CASE country ${caseClauses} ELSE sort_order END
            WHERE country IN (${codesList}) AND sort_order = 9999
        `));

        const maxOrderResult = await db.execute(sql`
            SELECT COALESCE(MAX(sort_order), 0) ::int AS max_order
            FROM country_registry
            WHERE sort_order < 9999
        `);
        const maxOrder = Number((maxOrderResult as Array<Record<string, unknown>>)[0]?.max_order ?? 0);
        const remainingRows = await db.execute(sql`
            SELECT country, region
            FROM country_registry
            WHERE sort_order = 9999
            ORDER BY region, country
        `);
        const remaining = remainingRows as Array<Record<string, unknown>>;
        if (remaining.length > 0) {
            const updateClauses = remaining
                .map((r, i) => `WHEN '${String(r.country).replace(/'/g, "''")}' THEN ${maxOrder + i + 1}`)
                .join(' ');
            const remainingCodes = remaining.map(r => `'${String(r.country).replace(/'/g, "''")}'`).join(', ');
            await db.execute(sql.raw(`
                UPDATE country_registry
                SET sort_order = CASE country ${updateClauses} ELSE sort_order END
                WHERE country IN (${remainingCodes}) AND sort_order = 9999
            `));
        }
    }

    private async backfillRegionColors(db: PostgresJsDatabase): Promise<void> {
        const map: Record<string, string> = {
            'NA': '#bfdbfe',
            'EU': '#a3e635',
            'LATAM': '#fef3c7',
            'APAC': '#dcfce7',
            '非洲': '#fde68a',
            '中东': '#fce7f3',
            'EMEA (METAP)': '#fde68a',
        };
        const entries = Object.entries(map);
        if (entries.length === 0) return;
        const caseClauses = entries
            .map(([region, color]) => `WHEN '${region.replace(/'/g, "''")}' THEN '${color}'`)
            .join(' ');
        const regionsList = entries.map(([r]) => `'${r.replace(/'/g, "''")}'`).join(', ');
        await db.execute(sql.raw(`
            UPDATE country_registry
            SET region_color = CASE region ${caseClauses} ELSE region_color END
            WHERE region IN (${regionsList}) AND (region_color IS NULL OR region_color = '')
        `));
    }

    async list(params: {
        page?: number;
        pageSize?: number;
        sortField?: string;
        sortOrder?: 'ascend' | 'descend';
    }): Promise<CountryRegistryListResponse> {
        const db = await this.ensureDb();
        const page = Math.max(params.page ?? 1, 1);
        const pageSize = Math.min(params.pageSize ?? 20, 100);
        const offset = (page - 1) * pageSize;

        const allowedSortFields = ['country', 'country_name', 'region', 'assessment_metric', 'status', 'created_at'];
        const sortField = allowedSortFields.includes(params.sortField ?? '')
            ? params.sortField!
            : 'created_at';
        const sortDir = params.sortOrder === 'ascend' ? 'ASC' : 'DESC';

        const countResult = await db.execute(
            sql`SELECT COUNT(*) ::int as count
                FROM country_registry`,
        );
        const total = Number((countResult as Array<Record<string, unknown>>)[0]?.count ?? 0);

        const rows = sortField === 'status'
            ? await db.execute(
                sql`SELECT id,
                           country,
                           country_name,
                           region,
                           assessment_metric,
                           assessment_value,
                           status,
                           created_at,
                           updated_at
                    FROM country_registry
                    ORDER BY CASE status
                                 WHEN '投放中' THEN 1
                                 WHEN '未投放' THEN 2
                                 WHEN '已暂停' THEN 3
                                 ELSE 4
                                 END ${sql.raw(sortDir)}, id ASC
            LIMIT ${pageSize}
                    OFFSET ${offset}`,
            )
            : await db.execute(
                sql`SELECT id,
                           country,
                           country_name,
                           region,
                           assessment_metric,
                           assessment_value,
                           status,
                           created_at,
                           updated_at
                    FROM country_registry
                    ORDER BY ${sql.raw(sortField)} ${sql.raw(sortDir)}
            LIMIT ${pageSize}
                    OFFSET ${offset}`,
            );

        const items: CountryRegistryRow[] = (rows as Array<Record<string, unknown>>).map(
            (r) => ({
                id: String(r.id ?? ''),
                country: String(r.country ?? ''),
                countryName: String(r.country_name ?? ''),
                region: String(r.region ?? ''),
                assessmentMetric: String(r.assessment_metric ?? ''),
                assessmentValue: String(r.assessment_value ?? ''),
                status: String(r.status ?? '投放中') as CountryRegistryRow['status'],
                createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ''),
                updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at ?? ''),
            }),
        );

        return {items, total, page, pageSize};
    }

    async create(dto: CountryRegistryCreateDto): Promise<CountryRegistryRow> {
        const db = await this.ensureDb();
        const countryName = dto.countryName?.trim() || COUNTRY_NAME_MAP[dto.country] || '';
        const rows = await db.execute(
            sql`INSERT INTO country_registry (country, country_name, region, assessment_metric, assessment_value,
                                              status)
                VALUES (${dto.country}, ${countryName}, ${dto.region}, ${dto.assessmentMetric ?? ''},
                        ${dto.assessmentValue ?? ''},
                        ${dto.status}) RETURNING id, country, country_name, region, assessment_metric, assessment_value, status, created_at, updated_at`,
        );
        const r = (rows as Array<Record<string, unknown>>)[0];
        return {
            id: String(r.id ?? ''),
            country: String(r.country ?? ''),
            countryName: String(r.country_name ?? ''),
            region: String(r.region ?? ''),
            assessmentMetric: String(r.assessment_metric ?? ''),
            assessmentValue: String(r.assessment_value ?? ''),
            status: String(r.status ?? '投放中') as CountryRegistryRow['status'],
            createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ''),
            updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at ?? ''),
        };
    }

    async updateStatus(
        id: string,
        status: string,
    ): Promise<CountryRegistryRow> {
        const db = await this.ensureDb();
        const rows = await db.execute(
            sql`UPDATE country_registry
                SET status     = ${status},
                    updated_at = NOW()
                WHERE id = ${id} RETURNING id, country, country_name, region, assessment_metric, assessment_value, status, created_at, updated_at`,
        );
        const r = (rows as Array<Record<string, unknown>>)[0];
        if (!r) throw new Error('NOT_FOUND');
        return {
            id: String(r.id ?? ''),
            country: String(r.country ?? ''),
            countryName: String(r.country_name ?? ''),
            region: String(r.region ?? ''),
            assessmentMetric: String(r.assessment_metric ?? ''),
            assessmentValue: String(r.assessment_value ?? ''),
            status: String(r.status ?? '投放中') as CountryRegistryRow['status'],
            createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ''),
            updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at ?? ''),
        };
    }

    async update(id: string, dto: CountryRegistryUpdateDto): Promise<CountryRegistryRow> {
        const db = await this.ensureDb();
        const setParts: ReturnType<typeof sql>[] = [];

        if (dto.country !== undefined) {
            setParts.push(sql`country
            =
            ${dto.country}`);
        }
        if (dto.countryName !== undefined) {
            setParts.push(sql`country_name
            =
            ${dto.countryName}`);
        }
        if (dto.region !== undefined) {
            setParts.push(sql`region
            =
            ${dto.region}`);
        }
        if (dto.assessmentMetric !== undefined) {
            setParts.push(sql`assessment_metric
            =
            ${dto.assessmentMetric}`);
        }
        if (dto.assessmentValue !== undefined) {
            setParts.push(sql`assessment_value
            =
            ${dto.assessmentValue}`);
        }
        if (dto.status !== undefined) {
            setParts.push(sql`status
            =
            ${dto.status}`);
        }

        if (setParts.length === 0) {
            const existing = await db.execute(
                sql`SELECT id,
                           country,
                           country_name,
                           region,
                           assessment_metric,
                           assessment_value,
                           status,
                           created_at,
                           updated_at
                    FROM country_registry
                    WHERE id = ${id}`,
            );
            const r = (existing as Array<Record<string, unknown>>)[0];
            if (!r) throw new Error('NOT_FOUND');
            return {
                id: String(r.id ?? ''),
                country: String(r.country ?? ''),
                countryName: String(r.country_name ?? ''),
                region: String(r.region ?? ''),
                assessmentMetric: String(r.assessment_metric ?? ''),
                assessmentValue: String(r.assessment_value ?? ''),
                status: String(r.status ?? '投放中') as CountryRegistryRow['status'],
                createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ''),
                updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at ?? ''),
            };
        }

        setParts.push(sql`updated_at
        = NOW()`);

        const rows = await db.execute(
            sql`UPDATE country_registry
                SET ${sql.join(setParts, sql`, `)}
                WHERE id = ${id} RETURNING id, country, country_name, region, assessment_metric, assessment_value, status, created_at, updated_at`,
        );

        const r = (rows as Array<Record<string, unknown>>)[0];
        if (!r) throw new Error('NOT_FOUND');
        return {
            id: String(r.id ?? ''),
            country: String(r.country ?? ''),
            countryName: String(r.country_name ?? ''),
            region: String(r.region ?? ''),
            assessmentMetric: String(r.assessment_metric ?? ''),
            assessmentValue: String(r.assessment_value ?? ''),
            status: String(r.status ?? '投放中') as CountryRegistryRow['status'],
            createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ''),
            updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at ?? ''),
        };
    }

    async delete(id: string): Promise<void> {
        const db = await this.ensureDb();
        await db.execute(sql`DELETE
                             FROM country_registry
                             WHERE id = ${id}`);
    }

    async getActiveCountries(userId?: string): Promise<string[]> {
        const db = await this.ensureDb();
        if (userId) {
            const rows = await db.execute(
                sql`SELECT cr.country
                    FROM country_registry cr
                             LEFT JOIN user_country_display_settings uds
                                       ON cr.country = uds.country_code AND uds.user_id = ${userId}
                    WHERE (uds.show = true)
                       OR (uds.show IS NULL AND cr.status = '投放中')`,
            );
            return (rows as Array<Record<string, unknown>>).map((r) => String(r.country ?? ''));
        }
        const rows = await db.execute(
            sql`SELECT country
                FROM country_registry
                WHERE status = '投放中'
                   OR show_in_reports = true`,
        );
        return (rows as Array<Record<string, unknown>>).map((r) => String(r.country ?? ''));
    }

    async getPausedCountries(): Promise<string[]> {
        const db = await this.ensureDb();
        const rows = await db.execute(
            sql`SELECT country
                FROM country_registry
                WHERE status != '投放中'`,
        );
        return (rows as Array<Record<string, unknown>>).map((r) => String(r.country ?? ''));
    }

    async getRegions(): Promise<string[]> {
        const db = await this.ensureDb();
        const rows = await db.execute(
            sql`SELECT DISTINCT region
                FROM country_registry
                WHERE region IS NOT NULL
                  AND region != ''
                ORDER BY region`,
        );
        return (rows as Array<Record<string, unknown>>).map((r) => String(r.region ?? ''));
    }

    async getReportCountries(): Promise<Array<{
        code: string;
        name: string;
        region: string;
        regionColor: string;
        sortOrder: number;
        status: string;
        showInReports: boolean;
    }>> {
        const db = await this.ensureDb();
        const rows = await db.execute(sql`
            SELECT country, country_name, region, region_color, sort_order, status, show_in_reports
            FROM country_registry
            WHERE 1 = 1
            ORDER BY sort_order ASC, country ASC
        `);
        return (rows as Array<Record<string, unknown>>).map((r) => ({
            code: String(r.country ?? ''),
            name: String(r.country_name ?? r.country ?? ''),
            region: String(r.region ?? ''),
            regionColor: String(r.region_color ?? ''),
            sortOrder: Number(r.sort_order ?? 9999),
            status: String(r.status ?? '投放中'),
            showInReports: Boolean(r.show_in_reports),
        }));
    }

    async getVisibility(): Promise<CountryRegistryVisibilityResponse> {
        const db = await this.ensureDb();
        const rows = await db.execute(sql`
            SELECT id, country, country_name, region, status, show_in_reports
            FROM country_registry
            ORDER BY country
        `);
        const items: CountryRegistryVisibilityItem[] = (rows as Array<Record<string, unknown>>).map(
            (r) => ({
                id: String(r.id ?? ''),
                country: String(r.country ?? ''),
                countryName: String(r.country_name ?? ''),
                region: String(r.region ?? ''),
                status: String(r.status ?? '投放中') as CountryRegistryVisibilityItem['status'],
                showInReports: Boolean(r.show_in_reports),
            }),
        );
        return {items};
    }

    async setVisibility(id: string, showInReports: boolean): Promise<void> {
        const db = await this.ensureDb();
        await db.execute(
            sql`UPDATE country_registry
                SET show_in_reports = ${showInReports},
                    updated_at      = NOW()
                WHERE id = ${id}`,
        );
    }

    async forceResetAll(): Promise<CountryRegistryForceResetResponse> {
        const db = await this.ensureDb();

        const countryRows = await db.execute(
            sql`SELECT country, status
                FROM country_registry
                ORDER BY country`,
        ) as Array<Record<string, unknown>>;
        const countries: Array<{ code: string; status: string }> = countryRows.map((r) => ({
            code: String(r.country ?? ''),
            status: String(r.status ?? '投放中'),
        }));

        const userRows = await db.execute(
            sql`SELECT DISTINCT user_id
                FROM user_country_display_settings`,
        ) as Array<Record<string, unknown>>;
        const userIds: string[] = userRows.map((r) => String(r.user_id ?? ''));

        let resetCount = 0;
        let skippedCount = 0;

        for (const userId of userIds) {
            for (const c of countries) {
                const defaultShow = c.status === '投放中';
                try {
                    await db.execute(
                        sql`INSERT INTO user_country_display_settings (user_id, country_code, show)
                            VALUES (${userId}, ${c.code}, ${defaultShow}) ON CONFLICT (user_id, country_code) DO
                        UPDATE SET show = ${defaultShow}, updated_at = NOW()`,
                    );
                    resetCount++;
                } catch (err) {
                    this.logger.error(
                        `Failed to reset display setting for user ${userId} country ${c.code}: ${String(err)}`,
                    );
                    skippedCount++;
                }
            }
        }

        const dataSourceCountries = await db.execute(
            sql`SELECT DISTINCT country
                FROM data_source
                WHERE country IS NOT NULL
                  AND country != '' AND cost > 0`,
        ) as Array<Record<string, unknown>>;
        const dataSourceCountrySet = new Set(
            dataSourceCountries.map((r) => String(r.country ?? '')),
        );
        const registryCountrySet = new Set(countries.map((c) => c.code));
        const dataSourceOnlyCountries: string[] = [];
        for (const code of dataSourceCountrySet) {
            if (!registryCountrySet.has(code)) {
                dataSourceOnlyCountries.push(code);
            }
        }
        dataSourceOnlyCountries.sort();

        this.logger.log(
            `Force reset: ${userIds.length} users, ${countries.length} countries, ` +
            `${resetCount} reset, ${skippedCount} skipped, ` +
            `${dataSourceOnlyCountries.length} data-source-only countries: [${dataSourceOnlyCountries.join(', ')}]`,
        );

        return {
            totalUsers: userIds.length,
            totalCountries: countries.length,
            resetCount,
            skippedCount,
            dataSourceOnlyCountries,
            dataSourceCountryCount: dataSourceCountrySet.size,
            registryCountryCount: registryCountrySet.size,
        };
    }

    async resetAllUserSettingsForCountry(
        countryCode: string,
        newStatus: string,
    ): Promise<void> {
        const db = await this.ensureDb();
        await db.execute(
            sql`DELETE
                FROM user_country_display_settings
                WHERE country_code = ${countryCode}`,
        );
        this.logger.log(
            `Reset all user display settings for country ${countryCode} (new status: ${newStatus})`,
        );
    }

    async getAllCountries(): Promise<Array<{ code: string; name: string; region: string; status: string }>> {
        const db = await this.ensureDb();
        const rows = await db.execute(
            sql`SELECT country, country_name, region, status
                FROM country_registry
                ORDER BY country`,
        );
        return (rows as Array<Record<string, unknown>>).map((r) => ({
            code: String(r.country ?? ''),
            name: String(r.country_name ?? COUNTRY_NAME_MAP[String(r.country ?? '')] ?? ''),
            region: String(r.region ?? ''),
            status: String(r.status ?? '投放中'),
        }));
    }

    async batchImport(
        items: CountryRegistryBatchImportItem[],
    ): Promise<CountryRegistryBatchImportResponse> {
        const db = await this.ensureDb();
        let inserted = 0;
        let updated = 0;

        for (const item of items) {
            const existing = await db.execute(
                sql`SELECT id
                    FROM country_registry
                    WHERE country = ${item.country}`,
            );
            const exists = (existing as Array<Record<string, unknown>>).length > 0;

            if (exists) {
                await db.execute(sql`
                    UPDATE country_registry
                    SET country_name      = ${item.countryName},
                        region            = ${item.region},
                        assessment_metric = ${item.assessmentMetric},
                        assessment_value  = ${item.assessmentValue},
                        status            = ${item.status},
                        updated_at        = NOW()
                    WHERE country = ${item.country}
                `);
                updated++;
            } else {
                await db.execute(sql`
                    INSERT INTO country_registry (country, country_name, region, assessment_metric, assessment_value,
                                                  status)
                    VALUES (${item.country}, ${item.countryName}, ${item.region}, ${item.assessmentMetric},
                            ${item.assessmentValue}, ${item.status})
                `);
                inserted++;
            }
        }

        this.logger.log(`Batch import: ${inserted} inserted, ${updated} updated`);
        return {inserted, updated};
    }
}
