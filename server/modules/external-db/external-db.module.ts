import {Global, Module} from '@nestjs/common';
import {ExternalDbService} from './external-db.service';

@Global()  // 标记为全局模块，其他模块无需手动导入就能用这个服务
@Module({
    providers: [ExternalDbService], // 我把 ExternalDbService 注册到容器里了
    exports: [ExternalDbService],   // 我允许其他模块借用这个服务
})
export class ExternalDbModule {
}