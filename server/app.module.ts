import {Module} from '@nestjs/common';
import {APP_GUARD} from '@nestjs/core';
import {AuthModule} from './modules/auth/auth.module';
import {JwtAuthGuard} from './modules/auth/jwt-auth.guard';
import {RolesGuard} from './modules/auth/roles.guard';
import {ExternalDbModule} from './modules/external-db/external-db.module';
import {AdDataModule} from './modules/ad-data/ad-data.module';
import {DataUploadModule} from "@server/modules/data-upload/data-upload.module";
import {CountryRegistryModule} from './modules/country-registry/country-registry.module';
import {UserPreferencesModule} from './modules/user-preferences/user-preferences.module';
import { CreativeAssetRegistryModule } from './modules/creative-asset-registry/creative-asset-registry.module';

@Module({
    imports: [
        AuthModule,                  // ← 必须放最前面
        ExternalDbModule,
        AdDataModule,
        DataUploadModule,
        CountryRegistryModule,
        UserPreferencesModule,
        CreativeAssetRegistryModule,
    ],
    providers: [
        // 全局 JWT 守卫（除 @Public 标记外都要求登录）
        {provide: APP_GUARD, useClass: JwtAuthGuard},
        // 全局角色守卫（检查 @Roles 标记）
        {provide: APP_GUARD, useClass: RolesGuard},
    ],
})
export class AppModule {
}