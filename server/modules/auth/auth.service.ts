import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
    OnModuleInit,
    UnauthorizedException,
} from '@nestjs/common';
import {JwtService} from '@nestjs/jwt';
import {ExternalDbService} from '../external-db/external-db.service';
import {sql} from 'drizzle-orm';
import type {PostgresJsDatabase} from 'drizzle-orm/postgres-js';
import * as bcrypt from 'bcryptjs';


interface UserRow {
    id: string;
    username: string;
    display_name: string;
    password_hash: string;
    role: string;
    status: string;
    must_change_password: boolean;
    last_login_at: string | null;
    created_at: string;
    updated_at: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
    private readonly logger = new Logger(AuthService.name);
    private db: PostgresJsDatabase | null = null;

    /**
     * 检查用户是否处于激活状态（status === 'active'）
     * 用于 JwtAuthGuard 每次请求时校验用户状态
     *
     * ⚠️ 加内存缓存（60秒 TTL），避免每次请求都查数据库
     *    代价：禁用用户后最多 60 秒才完全生效
     */
    private userStatusCache = new Map<string, { active: boolean; expiresAt: number }>();
    private static readonly USER_STATUS_CACHE_TTL = 60 * 1000; // 60 秒

    async isUserActive(userId: string): Promise<boolean> {
        // 1. 先查缓存
        const cached = this.userStatusCache.get(userId);
        if (cached && Date.now() < cached.expiresAt) {
            return cached.active;
        }

        // 2. 缓存未命中，查数据库
        const db = await this.ensureDb();
        const rows = await db.execute(sql`
            SELECT status
            FROM ttp_users
            WHERE id = ${userId} LIMIT 1
        `);
        const row = (rows as unknown as Array<{ status: string }>)[0];
        const active = !!row && row.status === 'active';

        // 3. 写缓存
        this.userStatusCache.set(userId, {
            active,
            expiresAt: Date.now() + AuthService.USER_STATUS_CACHE_TTL,
        });

        return active;
    }

    /**
     * 清除某个用户的状态缓存
     * 用于「禁用/启用/重置密码」等操作后立即生效
     */
    clearUserStatusCache(userId: string): void {
        this.userStatusCache.delete(userId);
    }

    constructor(
        private readonly externalDb: ExternalDbService,
        private readonly jwtService: JwtService,
    ) {
    }

    async onModuleInit(): Promise<void> {
        await this.ensureDb();
        await this.ensureAdminUser();
    }

    private async ensureDb(): Promise<PostgresJsDatabase> {
        if (this.db) return this.db;
        const db = await this.externalDb.getDb();

        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS ttp_users
            (
                id
                UUID
                PRIMARY
                KEY
                DEFAULT
                gen_random_uuid
            (
            ),
                username VARCHAR
            (
                100
            ) NOT NULL UNIQUE,
                display_name VARCHAR
            (
                100
            ) NOT NULL DEFAULT '',
                password_hash VARCHAR
            (
                200
            ) NOT NULL,
                role VARCHAR
            (
                20
            ) NOT NULL DEFAULT 'user',
                status VARCHAR
            (
                20
            ) NOT NULL DEFAULT 'active',
                must_change_password BOOLEAN NOT NULL DEFAULT false,
                last_login_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW
            (
            ),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW
            (
            )
                )
        `);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ttp_users_username ON ttp_users(username)`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ttp_users_status ON ttp_users(status)`);

        this.db = db;
        this.logger.log('ttp_users table ensured');
        return db;
    }

    /**
     * 首次启动时自动创建管理员账号
     * 逻辑：
     *   1. 检查 ttp_users 表里是否已有该管理员
     *   2. 没有 → 创建，并设置初始密码
     *   3. 已有 → 跳过（不会覆盖已有密码）
     *
     * 注意：管理员初始账号的 must_change_password 设为 false，
     *       避免首次登录被强制跳转到修改密码页。
     */
    private async ensureAdminUser(): Promise<void> {
        const adminUsername = process.env.ADMIN_USERNAME ?? '蒋俊';
        const adminPassword = process.env.ADMIN_INITIAL_PASSWORD ?? 'Ttp-Admin-2026';
        const db = await this.ensureDb();

        const rows = await db.execute(sql`
            SELECT id
            FROM ttp_users
            WHERE username = ${adminUsername} LIMIT 1
        `);
        if ((rows as Array<unknown>).length > 0) {
            return;   // 已存在，跳过
        }

        const hash = await bcrypt.hash(adminPassword, 10);
        await db.execute(sql`
            INSERT INTO ttp_users (username, display_name, password_hash, role, status, must_change_password)
            VALUES (${adminUsername}, ${adminUsername}, ${hash}, 'admin', 'active', false)
        `);
        //                                                                       ↑ 改成 false

        this.logger.log(`✅ 管理员账号已创建：${adminUsername}（初始密码：${adminPassword}）`);
    }

    /** 注册：重名自动加数字 */
    async register(username: string, password: string): Promise<{ username: string; message: string }> {
        if (!username || !username.trim()) throw new BadRequestException('请输入用户名');
        if (!password || password.length < 6) throw new BadRequestException('密码长度至少 6 位');

        const db = await this.ensureDb();
        const baseName = username.trim();

        // 检查是否重名，自动加数字
        let finalUsername = baseName;
        let suffix = 0;
        while (true) {
            const existing = await db.execute(sql`
                SELECT id
                FROM ttp_users
                WHERE username = ${finalUsername} LIMIT 1
            `);
            if ((existing as Array<unknown>).length === 0) break;
            suffix += 1;
            finalUsername = `${baseName}${suffix}`;
            if (suffix > 100) throw new BadRequestException('用户名过多冲突，请换一个');
        }

        const hash = await bcrypt.hash(password, 10);
        await db.execute(sql`
            INSERT INTO ttp_users (username, display_name, password_hash, role, status)
            VALUES (${finalUsername}, ${finalUsername}, ${hash}, 'user', 'active')
        `);

        this.logger.log(`新用户注册：${finalUsername}`);

        const message = finalUsername === baseName
            ? '注册成功，请登录'
            : `"${baseName}" 已被占用，系统为您分配用户名：${finalUsername}，请使用此用户名登录`;

        return {username: finalUsername, message};
    }

    /** 登录 */
    async login(username: string, password: string): Promise<{
        token: string;
        user: { id: string; username: string; role: string; mustChangePassword: boolean };
    }> {
        const db = await this.ensureDb();
        const rows = await db.execute(sql`
            SELECT id, username, display_name, password_hash, role, status, must_change_password
            FROM ttp_users
            WHERE username = ${username} LIMIT 1
        `);
        const user = (rows as unknown as Array<UserRow>)[0];
        if (!user) throw new UnauthorizedException('用户名或密码错误');
        if (user.status === 'disabled') throw new UnauthorizedException('账号已被禁用，请联系管理员');

        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) throw new UnauthorizedException('用户名或密码错误');

        // 更新最后登录时间
        await db.execute(sql`
            UPDATE ttp_users
            SET last_login_at = NOW(),
                updated_at    = NOW()
            WHERE id = ${user.id}
        `);

        const token = await this.jwtService.signAsync({
            sub: user.id,
            username: user.username,
            role: user.role,
        });

        return {
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                mustChangePassword: user.must_change_password,
            },
        };
    }

    /** 获取当前用户信息 */
    async getMe(userId: string): Promise<{
        id: string; username: string; role: string; mustChangePassword: boolean;
    }> {
        const db = await this.ensureDb();
        const rows = await db.execute(sql`
            SELECT id, username, role, must_change_password
            FROM ttp_users
            WHERE id = ${userId} LIMIT 1
        `);
        const user = (rows as unknown as Array<UserRow>)[0];
        if (!user) throw new NotFoundException('用户不存在');
        return {
            id: user.id,
            username: user.username,
            role: user.role,
            mustChangePassword: user.must_change_password,
        };
    }

    /** 修改密码（登录后） */
    async changePassword(
        userId: string,
        oldPassword: string,
        newPassword: string,
    ): Promise<{ success: boolean }> {
        if (!newPassword || newPassword.length < 6) {
            throw new BadRequestException('新密码长度至少 6 位');
        }
        const db = await this.ensureDb();
        const rows = await db.execute(sql`
            SELECT password_hash
            FROM ttp_users
            WHERE id = ${userId} LIMIT 1
        `);
        const user = (rows as unknown as Array<{ password_hash: string }>)[0];
        if (!user) throw new NotFoundException('用户不存在');

        const ok = await bcrypt.compare(oldPassword, user.password_hash);
        if (!ok) throw new UnauthorizedException('原密码错误');

        const newHash = await bcrypt.hash(newPassword, 10);
        await db.execute(sql`
            UPDATE ttp_users
            SET password_hash        = ${newHash},
                must_change_password = false,
                updated_at           = NOW()
            WHERE id = ${userId}
        `);
        return {success: true};
    }

    // ========================================
    // 以下方法仅管理员可用
    // ========================================

    /** 列出所有用户 */
    async listUsers(): Promise<Array<{
        id: string; username: string; role: string; status: string;
        lastLoginAt: string | null; createdAt: string;
    }>> {
        const db = await this.ensureDb();
        const rows = await db.execute(sql`
            SELECT id, username, role, status, last_login_at, created_at
            FROM ttp_users
            ORDER BY created_at DESC
        `);
        return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
            id: String(r.id),
            username: String(r.username),
            role: String(r.role),
            status: String(r.status),
            lastLoginAt: r.last_login_at ? String(r.last_login_at) : null,
            createdAt: String(r.created_at),
        }));
    }

    /** 禁用用户 */
    async disableUser(targetId: string, currentUserId: string): Promise<{ success: boolean }> {
        if (targetId === currentUserId) throw new BadRequestException('不能禁用自己的账号');
        const db = await this.ensureDb();
        await db.execute(sql`
            UPDATE ttp_users
            SET status     = 'disabled',
                updated_at = NOW()
            WHERE id = ${targetId}
        `);
        this.clearUserStatusCache(targetId);
        return {success: true};
    }

    /** 启用用户 */
    async enableUser(targetId: string): Promise<{ success: boolean }> {
        const db = await this.ensureDb();
        await db.execute(sql`
            UPDATE ttp_users
            SET status     = 'active',
                updated_at = NOW()
            WHERE id = ${targetId}
        `);
        this.clearUserStatusCache(targetId);
        return {success: true};
    }

    /** 重置密码为临时密码，用户首次登录后强制改密 */
    async resetPassword(targetId: string): Promise<{ tempPassword: string }> {
        const db = await this.ensureDb();
        // 生成临时密码：ttp_ + 6 位随机
        const tempPassword = `ttp_${Math.random().toString(36).slice(2, 8)}`;
        const hash = await bcrypt.hash(tempPassword, 10);
        await db.execute(sql`
            UPDATE ttp_users
            SET password_hash        = ${hash},
                must_change_password = false,
                updated_at           = NOW()
            WHERE id = ${targetId}
        `);
        this.clearUserStatusCache(targetId);
        return {tempPassword};
    }
}