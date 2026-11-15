import { Module } from '@nestjs/common';
import { TransitionsController } from './transitions.controller';
import { TransitionsService } from './transitions.service';

@Module({
  controllers: [TransitionsController],
  providers: [TransitionsService],
})
export class TransitionsModule {}
