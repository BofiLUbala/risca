import { Module } from '@nestjs/common';
import { ChildrenService } from './children.service';
import { TimelineService } from './timeline.service';
import { ChildrenController } from './children.controller';
import { ApprovalsModule } from '../approvals/approvals.module';

@Module({
  imports: [ApprovalsModule],
  providers: [ChildrenService, TimelineService],
  controllers: [ChildrenController],
  exports: [ChildrenService, TimelineService],
})
export class ChildrenModule {}
