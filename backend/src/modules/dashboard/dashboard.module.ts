import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { ApprovalsModule } from '../approvals/approvals.module';
import { ChildrenModule } from '../children/children.module';
import { ChannelsModule } from '../channels/channels.module';

@Module({
  imports: [LedgerModule, ApprovalsModule, ChildrenModule, ChannelsModule],
  providers: [DashboardService],
  controllers: [DashboardController],
  exports: [DashboardService],
})
export class DashboardModule {}
