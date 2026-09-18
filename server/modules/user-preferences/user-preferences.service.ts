import {Injectable, Logger} from '@nestjs/common';
import {ExternalDbService} from '../external-db/external-db.service';
import {sql} from 'drizzle-orm';
import type {PostgresJsDatabase} from 'drizzle-orm/postgres-js';

// 本地开发无用户系统，使用固定 userId
const LOCAL_USER_ID = 'local-dev';

@Injectable()
export class UserPreferencesService {
    private readonly logger = new Logger(UserPreferencesService.name);
    private db: PostgresJsDatabase | null = null;

    constructor(private readonly externalDb: ExternalDbService) {
    }

    private async ensureDb(): Promise<PostgresJsDatabase> {
        if (this.db) return this.db;
        const db = await this.externalDb.getDb();
        await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(200) NOT NULL,
        preference_key VARCHAR(200) NOT NULL,
        preference_value TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_user_preferences UNIQUE (user_id, preference_key)
      )
    `);
        this.db = db;
        return db;
    }

    getUserId(): string {
        return LOCAL_USER_ID;
    }

    async get(key: string): Promise<{ key: string; value: string; updatedAt: string } | null> {
        const db = await this.ensureDb();
        const rows = await db.execute(sql`
      SELECT preference_key, preference_value, updated_at
      FROM user_preferences
      WHERE user_id = ${LOCAL_USER_ID} AND preference_key = ${key}
    `);
        const r = (rows as Array<Record<string, unknown>>)[0];
        if (!r) return null;
        return {
            key: String(r.preference_key ?? ''),
            value: String(r.preference_value ?? ''),
            updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at ?? ''),
        };
    }

    async getBatch(keys: string[]): Promise<Array<{ key: string; value: string; updatedAt: string }>> {
        if (keys.length === 0) return [];
        const db = await this.ensureDb();
        const keyList = sql.join(keys.map((k) => sql`${k}`), sql`, `);
        const rows = await db.execute(sql`
      SELECT preference_key, preference_value, updated_at
      FROM user_preferences
      WHERE user_id = ${LOCAL_USER_ID} AND preference_key IN (${keyList})
    `);
        return (rows as Array<Record<string, unknown>>).map((r) => ({
            key: String(r.preference_key ?? ''),
            value: String(r.preference_value ?? ''),
            updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at ?? ''),
        }));
    }

    async set(key: string, value: string): Promise<{ key: string; value: string; updatedAt: string }> {
        const db = await this.ensureDb();
        const rows = await db.execute(sql`
      INSERT INTO user_preferences (user_id, preference_key, preference_value)
      VALUES (${LOCAL_USER_ID}, ${key}, ${value})
      ON CONFLICT (user_id, preference_key)
      DO UPDATE SET preference_value = EXCLUDED.preference_value, updated_at = NOW()
      RETURNING preference_key, preference_value, updated_at
    `);
        const r = (rows as Array<Record<string, unknown>>)[0];
        return {
            key: String(r.preference_key ?? ''),
            value: String(r.preference_value ?? ''),
            updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at ?? ''),
        };
    }

    async delete(key: string): Promise<void> {
        const db = await this.ensureDb();
        await db.execute(sql`
      DELETE FROM user_preferences
      WHERE user_id = ${LOCAL_USER_ID} AND preference_key = ${key}
    `);
    }
}