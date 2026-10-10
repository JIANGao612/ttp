import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
import {JwtService} from '@nestjs/jwt';
import type {Request} from 'express';
import {IS_PUBLIC_KEY} from './public.decorator';
import {AuthService} from './auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(
        private readonly jwtService: JwtService,
        private readonly reflector: Reflector,
        private readonly authService: AuthService,   // ← 新增注入
    ) {
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // 1. 公开接口直接放行
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) return true;

        // 2. 检查 Authorization 头
        const request = context.switchToHttp().getRequest<Request>();
        const auth = request.headers.authorization;
        if (!auth || !auth.startsWith('Bearer ')) {
            throw new UnauthorizedException('未登录或登录已过期');
        }

        // 3. 校验 JWT 签名
        let payload: any;
        try {
            payload = await this.jwtService.verifyAsync(auth.slice(7));
            (request as any).user = payload;
        } catch {
            throw new UnauthorizedException('未登录或登录已过期');
        }

        // 4. ⭐ 关键新增：检查用户是否被禁用
        //    （有 60 秒内存缓存，不会每次都查数据库）
        const active = await this.authService.isUserActive(payload.sub);
        if (!active) {
            throw new UnauthorizedException('账号已被禁用，请联系管理员');
        }

        return true;
    }
}