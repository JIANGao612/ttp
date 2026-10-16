/**
 * data-upload Controller
 *
 * 改动说明（相对原妙搭版本）：
 *  - 移除 @NeedLogin()（我们自己的登录系统用的是 JWT，全局 Guard 已覆盖）
 *  - 新增「multipart 文件上传」端点：POST /api/data-upload/upload-files
 *    接收 FormData（一个或多个文件 + uploadMode），直接调用 service.processBatchUploadBuffers
 *  - 保留原有的「按 downloadUrl 上传」端点（兼容本地调试）
 *  - 移除 import-local、campaign-mapping、mapping-refresh 等调试/维护端点（按需再补）
 */
import {
    Controller,
    Post,
    Get,
    Delete,
    Body,
    Param,
    Query,
    UploadedFiles,
    UseInterceptors,
    BadRequestException,
} from '@nestjs/common';
import {FilesInterceptor} from '@nestjs/platform-express';
import type {
    UploadRecordListResponse,
    ClearRecentDataResponse,
    BatchUploadResponse,
    BatchPollResponse,
    UploadMode,
} from '@shared/api.interface';
import {DataUploadService} from './data-upload.service';

/**
 * Multer 上传文件类型（不依赖 @types/multer 全局注入）
 * 字段来自 multer 运行时实际提供的对象结构
 */
interface MulterFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    buffer: Buffer;
    size: number;
}

/** 上传文件大小上限（单文件 50MB） */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

@Controller('api/data-upload')
export class DataUploadController {
    constructor(private readonly dataUploadService: DataUploadService) {
    }

    /**
     * ⭐ 核心端点：multipart 文件上传
     *
     * 前端 FormData 结构：
     *   - files: File[]   （1 个或多个文件）
     *   - uploadMode: string  （'paired' | 'hourly_noon' | 'hourly_first' | 'hourly_second' | 'hourly_third' | 'zero_cost'）
     *   - baselineDate?: string
     *
     * 示例：上传日报 + 映射两份文件（paired 模式）
     *   POST /api/data-upload/upload-files
     *   Content-Type: multipart/form-data
     *   files=[日报.xlsx, 映射.xlsx]
     *   uploadMode=paired
     */
    @Post('upload-files')
    @UseInterceptors(
        FilesInterceptor('files', 10, {
            limits: {fileSize: MAX_FILE_SIZE},
        }),
    )
    async uploadFiles(
        @UploadedFiles() files: MulterFile[],
        @Body('uploadMode') uploadMode?: string,
        @Body('baselineDate') baselineDate?: string,
    ): Promise<BatchUploadResponse> {
        if (!files || files.length === 0) {
            throw new BadRequestException('未接收到文件，请检查表单字段名是否为 files');
        }
        // 把 multer 的 file 数组转成 service 期望的 { fileName, buffer } 结构
        const payload = files.map((f) => ({
            fileName: f.originalname,
            buffer: f.buffer,
        }));
        return this.dataUploadService.processBatchUploadBuffers(
            payload,
            (uploadMode ?? 'hourly_noon') as UploadMode,
            baselineDate,
        );
    }

    /** 轮询上传进度 */
    @Get('batch/poll')
    async pollBatchResult(
        @Query('since') since: string,
        @Query('key') key: string,
    ): Promise<BatchPollResponse> {
        return this.dataUploadService.pollBatchResult(since, key);
    }

    /** 上传历史列表 */
    @Get('records')
    async getRecords(
        @Query('page') page = '1',
        @Query('pageSize') pageSize = '20',
    ): Promise<UploadRecordListResponse> {
        return this.dataUploadService.getUploadRecords(
            parseInt(page, 10),
            parseInt(pageSize, 10),
        );
    }

    /** 清空近 8 日数据 */
    @Post('clear-recent')
    async clearRecent(): Promise<ClearRecentDataResponse> {
        return this.dataUploadService.clearRecentData();
    }

    /** 检查是否有近 8 日数据 */
    @Get('check-recent')
    async checkRecent(): Promise<{ hasData: boolean; dateStart: string; dateEnd: string }> {
        return this.dataUploadService.hasRecentData();
    }

    /** 按日期范围删除 */
    @Delete('by-date-range')
    async deleteByDateRange(
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
    ): Promise<{ deleted: number }> {
        return this.dataUploadService.deleteByDateRange(startDate, endDate);
    }

    /** 手动重建环比基准 */
    @Post('backfill-baseline')
    async backfillBaseline(
        @Body() body: { startDate: string; endDate: string },
    ): Promise<{ rowsInserted: number; days: number }> {
        return this.dataUploadService.backfillDailyBaseline({
            start: body.startDate,
            end: body.endDate,
        });
    }

    /** 删除某天的环比基准 */
    @Post('baseline-delete')
    async deleteBaseline(@Body() body: { date: string }): Promise<{ success: boolean }> {
        await this.dataUploadService.deleteDailyBaseline(body.date);
        return {success: true};
    }
}