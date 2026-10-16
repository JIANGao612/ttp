/**
 * ExternalDbService —— 外部 TT-Promote RDB 连接管理（脱离妙搭版）
 *
 * 相对妙搭版本的改动：
 *  - 移除 ConnectionsService / DRIZZLE_DATABASE / SafetyService / appDb 依赖
 *  - 直接从 .env 的 DATABASE_URL 建立连接
 *  - 移除连接参数缓存到应用库的逻辑
 *  - 移除 patchSessionToBypassMonkeyPatch（脱离沙箱后不需要）
 *  - 保留指纹校验（防止 .env 被误改指向其他库）
 *
 * 对外接口（与旧版一致）：
 *  - getDb()                       → Drizzle 实例（主连接池）
 *  - getRawClient()                → 原始 postgres-js client（advisory lock / reserve 用）
 *  - getLongTimeoutDb(timeoutMs)   → 独立连接，用于大查询（可自定义 statement_timeout）
 *  - getRawClientLongTimeout()     → 独立原始 client（用于 cursor 流式导出）
 */
import {Injectable, Logger, OnModuleInit} from '@nestjs/common';
import {drizzle} from 'drizzle-orm/postgres-js';
import type {PostgresJsDatabase} from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config();

// ============================================================
// 指纹校验（防止 .env 被误改指向错误的库）
// ============================================================
const EXPECTED_EXTERNAL_DB_HOST = '115.190.136.243';
const EXPECTED_EXTERNAL_DB_NAME = 'TT-Promote';

function matchesExpectedExternalDb(host: string, database: string | undefined): boolean {
    return host === EXPECTED_EXTERNAL_DB_HOST && database === EXPECTED_EXTERNAL_DB_NAME;
}

// ============================================================
// Service
// ============================================================
@Injectable()
export class ExternalDbService implements OnModuleInit {
    private readonly logger = new Logger(ExternalDbService.name);

    /** 主连接池的 Drizzle 实例 */
    private _db: PostgresJsDatabase | null = null;

    /** 主连接池的原始 postgres-js client */
    private _client: postgres.Sql | null = null;

    /** 从 DATABASE_URL 解析出的 host / database（用于指纹校验） */
    private _parsedHost: string | null = null;
    private _parsedDb: string | null = null;

    async onModuleInit(): Promise<void> {
        try {
            await this.getDb();
            this.logger.log('External RDB warmed up on module init');
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`External RDB warm-up failed (will retry on first use): ${msg}`);
        }
    }

    // ============================================================
    // 解析 DATABASE_URL
    // ============================================================

    /**
     * 从 .env 的 DATABASE_URL 解析连接信息
     *
     * 期望格式：
     *   DATABASE_URL=postgresql://user:pass@host:5432/dbname
     * 可选参数：
     *   ?sslmode=require
     */
    private parseDatabaseUrl(): {
        connectionString: string;
        host: string;
        database: string;
        sslMode?: string;
    } {
        const url = process.env.DATABASE_URL;
        if (!url) {
            throw new Error('环境变量 DATABASE_URL 未配置，请在 .env 里设置');
        }

        // 用 URL 解析（Node 原生）
        let parsed: URL;
        try {
            // postgres:// 和 postgresql:// 两种协议都要支持
            const normalized = url.replace(/^postgres:\/\//, 'postgresql://');
            parsed = new URL(normalized);
        } catch {
            throw new Error(`DATABASE_URL 格式非法: ${url}`);
        }

        const host = parsed.hostname;
        const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
        const sslMode = parsed.searchParams.get('sslmode') ?? undefined;

        return {connectionString: url, host, database, sslMode};
    }

    /**
     * 校验连接目标是否符合指纹
     */
    private verifyFingerprint(host: string, database: string): void {
        if (!matchesExpectedExternalDb(host, database)) {
            throw new Error(
                `外部库目标 ${host}/${database} 不符合 TT-Promote 指纹（${EXPECTED_EXTERNAL_DB_HOST}/${EXPECTED_EXTERNAL_DB_NAME}），拒绝连接。` +
                `如果是正常的数据库迁移，请同步修改 external-db.service.ts 里的 EXPECTED_EXTERNAL_DB_HOST / NAME`,
            );
        }
    }

    // ============================================================
    // 主连接池
    // ============================================================

    /**
     * 获取主连接池的原始 postgres-js client（同步）
     *
     * 用于需要独立连接或 postgres-js 特有能力（reserve / unsafe）的场景
     */
    getRawClient(): postgres.Sql {
        if (this._client) return this._client;

        const {connectionString, host, database, sslMode} = this.parseDatabaseUrl();
        this.verifyFingerprint(host, database);
        this._parsedHost = host;
        this._parsedDb = database;

        this._client = postgres(connectionString, {
            ssl: sslMode === 'require' || sslMode === 'verify-full' ? 'require' : undefined,
            max: 10,
            idle_timeout: 180,
            connect_timeout: 10,
            max_lifetime: 0,
            prepare: false,
            onnotice: () => {
            },
        });

        this.logger.log(
            `External RDB client created: host=${host}, db=${database}, ssl=${sslMode ?? 'off'}`,
        );
        return this._client;
    }

    /**
     * 获取主连接池的 Drizzle 实例
     */
    async getDb(): Promise<PostgresJsDatabase> {
        if (!this._db) {
            const client = this.getRawClient();
            this._db = drizzle(client) as unknown as PostgresJsDatabase;
            this.logger.log('External RDB Drizzle instance initialized');
        }
        return this._db;
    }

    // ============================================================
    // 长超时 / 独立连接
    // ============================================================

    /**
     * 获取一个独立连接的长超时 Drizzle 实例
     *
     * 说明：postgres-js 的 statement_timeout 是 per-connection 的，
     *      无法动态修改主连接池的超时，所以这里新建一个独立 client。
     *
     * 用途：报表全量聚合（可能跑几十秒）
     *
     * 注意：每次调用都会新建 client（用完不主动关闭，交给进程回收）。
     *      调用频率低（每次大查询），可接受。如果你担心连接泄漏，
     *      可以改成缓存 + 按 timeoutMs 分档缓存。
     */
    async getLongTimeoutDb(timeoutMs: number = 600000): Promise<PostgresJsDatabase> {
        const {connectionString, host, database, sslMode} = this.parseDatabaseUrl();
        this.verifyFingerprint(host, database);

        // 在连接字符串里追加 statement_timeout
        const sep = connectionString.includes('?') ? '&' : '?';
        const connStr = `${connectionString}${sep}options=${encodeURIComponent(`-c statement_timeout=${timeoutMs}`)}`;

        const client = postgres(connStr, {
            ssl: sslMode === 'require' || sslMode === 'verify-full' ? 'require' : undefined,
            max: 1,
            idle_timeout: 300,
            connect_timeout: 10,
            max_lifetime: 0,
            prepare: false,
            onnotice: () => {
            },
        });
        return drizzle(client) as unknown as PostgresJsDatabase;
    }

    /**
     * 获取一个独立连接的原始 client（长超时）
     *
     * 用途：cursor 流式导出（导出百万行数据）
     */
    async getRawClientLongTimeout(): Promise<postgres.Sql> {
        const {connectionString, host, database, sslMode} = this.parseDatabaseUrl();
        this.verifyFingerprint(host, database);

        const sep = connectionString.includes('?') ? '&' : '?';
        const connStr = `${connectionString}${sep}options=${encodeURIComponent('-c statement_timeout=180000')}`;

        return postgres(connStr, {
            ssl: sslMode === 'require' || sslMode === 'verify-full' ? 'require' : undefined,
            max: 1,
            idle_timeout: 60,
            connect_timeout: 10,
            max_lifetime: 0,
            prepare: false,
            onnotice: () => {
            },
        });
    }

    // ============================================================
    // 健康检查（可选）
    // ============================================================

    /**
     * 主动测试连接：SELECT current_user, current_database()
     * 用于启动时验证配置
     */
    async testConnection(): Promise<{ user: string; database: string }> {
        const client = this.getRawClient();
        const rows = await client`SELECT current_user AS usr, current_database() AS db`;
        return {
            user: String(rows[0].usr),
            database: String(rows[0].db),
        };
    }
}