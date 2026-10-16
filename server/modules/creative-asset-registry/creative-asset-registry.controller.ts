import {Controller, Get, Query} from '@nestjs/common';
import {CreativeAssetRegistryService} from './creative-asset-registry.service';

@Controller('api/creative-asset-registry')
export class CreativeAssetRegistryController {
    constructor(private readonly service: CreativeAssetRegistryService) {
    }

    /** 内审表列表（分页） */
    @Get('list')
    async list(@Query() query: Record<string, string>) {
        return this.service.list({
            page: query.page ? parseInt(query.page, 10) : 1,
            pageSize: query.pageSize ? parseInt(query.pageSize, 10) : 50,
            country: query.country || undefined,
            week: query.week || undefined,
            auditStatus: query.auditStatus || undefined,
            productionStatus: query.productionStatus || undefined,
            keyword: query.keyword || undefined,
            sortField: query.sortField || undefined,
            sortOrder: (query.sortOrder as 'asc' | 'desc') || undefined,
        });
    }

    /** 筛选项 */
    @Get('filter-options')
    async getFilterOptions() {
        return this.service.getFilterOptions();
    }
}