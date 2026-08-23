import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { configuration, validationSchema } from './config/configuration';
import { getDatabaseConfig } from './config/database.config';
import { StorageModule } from './modules/storage/storage.module';
import { AIProviderModule } from './modules/ai-provider/ai-provider.module';
import { ResumeModule } from './modules/resume/resume.module';
import { HealthModule } from './modules/health/health.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { CompanyResearchModule } from './modules/company-research/company-research.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host', '127.0.0.1'),
          port: configService.get<number>('redis.port', 6379),
        },
      }),
    }),
    StorageModule,
    AIProviderModule,
    ResumeModule,
    HealthModule,
    CompaniesModule,
    ContactsModule,
    CompanyResearchModule,
  ],
})
export class AppModule {}
