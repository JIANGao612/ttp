/**
 * data-upload 模块定义
 *
 * 改动说明（相对原妙搭版本）：
 *  - 移除 CreativeAssetsModule / CreativeConsumptionTotalModule / TeamMemberMappingModule
 *    （第 3 批再补回来）
 *  - 移除 BackfillIdentityIdAutomation（妙搭触发器，本项目不需要）
 *  - 保留 DataUploadController + DataUploadService
 */
import {Module} from '@nestjs/common';
import {DataUploadController} from './data-upload.controller';
import {DataUploadService} from './data-upload.service';

@Module({
    controllers: [DataUploadController],
    providers: [DataUploadService],
    exports: [DataUploadService],
})
export class DataUploadModule {
}