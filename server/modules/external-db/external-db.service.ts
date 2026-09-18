import {Injectable, OnModuleInit} from '@nestjs/common';
import {drizzle} from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config();

@Injectable() // 标记为可被注入的提供者
export class ExternalDbService implements OnModuleInit {
    private _db: any;

    async onModuleInit() {
        await this.getDb();
    }

    async getDb() {
        if (!this._db) {
            const connectionString = process.env.DATABASE_URL;
            if (!connectionString) {
                throw new Error('DATABASE_URL environment variable is not set');
            }
            const client = postgres(connectionString);
            this._db = drizzle(client);
            console.log('✅ Database connected');
        }
        return this._db;
    }
}