import {Module} from '@nestjs/common';
import {AdDataModule} from './modules/ad-data/ad-data.module';
import {ExternalDbModule} from './modules/external-db/external-db.module';
import {CountryRegistryModule} from './modules/country-registry/country-registry.module';
import {UserPreferencesModule} from './modules/user-preferences/user-preferences.module';

@Module({
    imports: [
        ExternalDbModule,
        AdDataModule,
        CountryRegistryModule,
        UserPreferencesModule,
    ],
    controllers: [],
    providers: [],
})
export class AppModule {
}