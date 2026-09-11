import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Prospect } from './entities/prospect.entity';
import { ProspectsService } from './prospects.service';
import { ProspectsController } from './prospects.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Prospect])],
  controllers: [ProspectsController],
  providers: [ProspectsService],
  exports: [ProspectsService],
})
export class ProspectsModule {}
