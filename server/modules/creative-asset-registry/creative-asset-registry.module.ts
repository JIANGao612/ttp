import {Module} from '@nestjs/common';
import {CreativeAssetRegistryController} from './creative-asset-registry.controller';
import {CreativeAssetRegistryService} from './creative-asset-registry.service';

@Module({
    controllers: [CreativeAssetRegistryController],
    providers: [CreativeAssetRegistryService],
    exports: [CreativeAssetRegistryService],
})
export class CreativeAssetRegistryModule {
}