import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { ApprovalsModule } from '../approvals/approvals.module';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [ApprovalsModule, LedgerModule],
  providers: [ProjectsService],
  controllers: [ProjectsController],
  exports: [ProjectsService],
})
export class ProjectsModule {}
