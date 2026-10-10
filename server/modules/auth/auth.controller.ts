import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    Req,
} from '@nestjs/common';
import type {Request} from 'express';
import {AuthService} from './auth.service';
import {Public} from './public.decorator';
import {Roles} from './roles.decorator';

@Controller('api/auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {
    }

    @Public()
    @Post('register')
    async register(@Body() body: { username: string; password: string }) {
        return this.authService.register(body.username ?? '', body.password ?? '');
    }

    @Public()
    @Post('login')
    async login(@Body() body: { username: string; password: string }) {
        return this.authService.login(body.username ?? '', body.password ?? '');
    }

    @Get('me')
    async me(@Req() req: Request) {
        const userId = (req as any).user?.sub;
        return this.authService.getMe(userId);
    }

    @Post('change-password')
    async changePassword(
        @Req() req: Request,
        @Body() body: { oldPassword: string; newPassword: string },
    ) {
        const userId = (req as any).user?.sub;
        return this.authService.changePassword(userId, body.oldPassword ?? '', body.newPassword ?? '');
    }

    // ========================================
    // 管理员接口
    // ========================================

    @Roles('admin')
    @Get('users')
    async listUsers() {
        return {items: await this.authService.listUsers()};
    }

    @Roles('admin')
    @Post('users/:id/disable')
    async disableUser(@Req() req: Request, @Param('id') id: string) {
        const currentUserId = (req as any).user?.sub;
        return this.authService.disableUser(id, currentUserId);
    }

    @Roles('admin')
    @Post('users/:id/enable')
    async enableUser(@Param('id') id: string) {
        return this.authService.enableUser(id);
    }

    @Roles('admin')
    @Post('users/:id/reset-password')
    async resetPassword(@Param('id') id: string) {
        return this.authService.resetPassword(id);
    }
}