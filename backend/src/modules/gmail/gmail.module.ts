import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GmailAccount } from './entities/gmail-account.entity';
import { GmailService } from './gmail.service';
import { GmailController } from './gmail.controller';

@Module({
  imports: [TypeOrmModule.forFeature([GmailAccount])],
  controllers: [GmailController],
  providers: [GmailService],
  exports: [GmailService, TypeOrmModule],
})
export class GmailModule {}
