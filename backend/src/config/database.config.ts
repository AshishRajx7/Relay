import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const getDatabaseConfig = (configService: ConfigService): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get<string>('database.host', 'localhost'),
  port: configService.get<number>('database.port', 5432),
  username: configService.get<string>('database.username', 'relay'),
  password: configService.get<string>('database.password', 'relay_dev_password'),
  database: configService.get<string>('database.database', 'relay'),
  autoLoadEntities: true,
  synchronize: configService.get<boolean>('database.synchronize', false),
  logging: configService.get<boolean>('database.logging', true),
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  migrationsRun: false,
});
