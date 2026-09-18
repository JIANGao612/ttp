import {Module} from '@nestjs/common';
import {CountryRegistryController} from './country-registry.controller';
import {CountryRegistryService} from './country-registry.service';

@Module({
    controllers: [CountryRegistryController],
    providers: [CountryRegistryService],
    exports: [CountryRegistryService],
})
export class CountryRegistryModule {
}