import {Module} from '@nestjs/common';
import {AdDataController} from './ad-data.controller';
import {AdDataService} from './ad-data.service';

@Module({
    controllers: [AdDataController],
    providers: [AdDataService],
    exports: [AdDataService],
})
export class AdDataModule {
}