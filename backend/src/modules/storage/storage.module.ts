import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import { LocalStorageProvider } from './providers/local.provider';
import { STORAGE_PROVIDER_TOKEN } from '../../common/constants/app.constants';

@Global()
@Module({
  providers: [
    {
      provide: STORAGE_PROVIDER_TOKEN,
      useFactory: (configService: ConfigService) => {
        const localRoot = configService.get<string>('storage.localRoot', './uploads');
        return new LocalStorageProvider(localRoot);
      },
      inject: [ConfigService],
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
