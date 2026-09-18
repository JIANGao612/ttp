import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Param,
    Query,
    Body,
    HttpCode,
    HttpStatus,
    NotFoundException,
    BadRequestException,
    ConflictException,
} from '@nestjs/common';
import {CountryRegistryService} from './country-registry.service';
import type {
    CountryRegistryListResponse,
    CountryRegistryRow,
    CountryRegistryCreateDto,
    CountryRegistryUpdateDto,
    CountryRegistryActiveResponse,
    CountryRegistryVisibilityResponse,
    CountryRegistryVisibilityUpdateDto,
    CountryRegistryBatchImportDto,
    CountryRegistryBatchImportResponse,
    CountryRegistryStatusChangeDto,
    CountryRegistryForceResetResponse,
} from '@shared/api.interface';

/** 从数据库错误对象中提取 PostgreSQL 错误码 */
function extractPostgresErrorCode(err: unknown): string | undefined {
    if (!err || typeof err !== 'object') return undefined;
    const e = err as { code?: string; cause?: { code?: string } };
    return e.code ?? e.cause?.code;
}

@Controller('api/country-registry')
export class CountryRegistryController {
    constructor(private readonly service: CountryRegistryService) {
    }

    @Get()
    async list(
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
        @Query('sortField') sortField?: string,
        @Query('sortOrder') sortOrder?: string,
    ): Promise<CountryRegistryListResponse> {
        return this.service.list({
            page: page ? parseInt(page, 10) : undefined,
            pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
            sortField,
            sortOrder: sortOrder as 'ascend' | 'descend' | undefined,
        });
    }

    @Get('active')
    async getActiveCountries(): Promise<CountryRegistryActiveResponse> {
        const [countries, pausedCountries] = await Promise.all([
            this.service.getActiveCountries(),
            this.service.getPausedCountries(),
        ]);
        return {countries, pausedCountries};
    }

    @Get('regions')
    async getRegions(): Promise<{ regions: string[] }> {
        const regions = await this.service.getRegions();
        return {regions};
    }

    @Get('report-countries')
    async getReportCountries(): Promise<{
        countries: Array<{
            code: string;
            name: string;
            region: string;
            regionColor: string;
            sortOrder: number;
            status: string;
            showInReports: boolean;
        }>;
    }> {
        const countries = await this.service.getReportCountries();
        return {countries};
    }

    @Get('visibility')
    async getVisibility(): Promise<CountryRegistryVisibilityResponse> {
        return this.service.getVisibility();
    }

    @Post()
    async create(@Body() dto: CountryRegistryCreateDto): Promise<CountryRegistryRow> {
        if (!dto.country || !dto.region || !dto.status) {
            throw new BadRequestException('国家名称、大区、状态为必填');
        }
        try {
            return await this.service.create(dto);
        } catch (err) {
            if (extractPostgresErrorCode(err) === '23505') {
                throw new ConflictException(`国家 ${dto.country} 已存在，无法重复添加`);
            }
            throw err;
        }
    }

    @Patch(':id/status')
    async changeStatus(
        @Param('id') id: string,
        @Body() dto: CountryRegistryStatusChangeDto,
    ): Promise<CountryRegistryRow> {
        try {
            const result = await this.service.updateStatus(id, dto.status);
            await this.service.resetAllUserSettingsForCountry(result.country, dto.status);
            return result;
        } catch (err) {
            if (err instanceof Error && err.message === 'NOT_FOUND') {
                throw new NotFoundException('国家记录不存在');
            }
            throw err;
        }
    }

    @Get('all')
    async getAllCountries(): Promise<{
        countries: Array<{ code: string; name: string; region: string; status: string }>;
    }> {
        const countries = await this.service.getAllCountries();
        return {countries};
    }

    @Patch(':id')
    async update(
        @Param('id') id: string,
        @Body() dto: CountryRegistryUpdateDto,
    ): Promise<CountryRegistryRow> {
        try {
            return await this.service.update(id, dto);
        } catch (err) {
            if (err instanceof Error && err.message === 'NOT_FOUND') {
                throw new NotFoundException('国家记录不存在');
            }
            throw err;
        }
    }

    @Post('batch-import')
    async batchImport(
        @Body() dto: CountryRegistryBatchImportDto,
    ): Promise<CountryRegistryBatchImportResponse> {
        if (!dto.items || dto.items.length === 0) {
            throw new BadRequestException('导入数据不能为空');
        }
        return this.service.batchImport(dto.items);
    }

    @Patch(':id/visibility')
    async setVisibility(
        @Param('id') id: string,
        @Body() dto: CountryRegistryVisibilityUpdateDto,
    ): Promise<void> {
        await this.service.setVisibility(id, dto.showInReports);
    }

    @Post('admin/force-reset-all')
    async forceResetAll(): Promise<CountryRegistryForceResetResponse> {
        return this.service.forceResetAll();
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async delete(@Param('id') id: string): Promise<void> {
        await this.service.delete(id);
    }
}