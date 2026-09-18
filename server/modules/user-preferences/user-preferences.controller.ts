import {Body, Controller, Delete, Get, Param, Put, Query} from '@nestjs/common';
import {UserPreferencesService} from './user-preferences.service';

@Controller('api/user-preferences')
export class UserPreferencesController {
    constructor(private readonly service: UserPreferencesService) {
    }

    /**
     * 批量获取（必须在 /:key 之前定义，否则 "batch" 会被当成 key）
     * GET /api/user-preferences/batch?keys=a,b,c
     */
    @Get('batch')
    async getBatch(@Query('keys') keys?: string) {
        const keyList = keys ? keys.split(',').map((k) => k.trim()).filter(Boolean) : [];
        const items = await this.service.getBatch(keyList);
        return {items};
    }

    /**
     * 单个获取
     * GET /api/user-preferences/{key}
     */
    @Get(':key')
    async get(@Param('key') key: string) {
        return this.service.get(key);
    }

    /**
     * 单个写入（upsert）
     * PUT /api/user-preferences/{key}  body: { key, value }
     */
    @Put(':key')
    async set(@Param('key') key: string, @Body() body: { value: string }) {
        return this.service.set(key, body.value);
    }

    /**
     * 单个删除
     * DELETE /api/user-preferences/{key}
     */
    @Delete(':key')
    async remove(@Param('key') key: string) {
        await this.service.delete(key);
        return {success: true};
    }
}