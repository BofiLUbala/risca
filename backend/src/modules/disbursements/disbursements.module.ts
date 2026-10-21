import { Module } from '@nestjs/common';
import { DisbursementsService } from './disbursements.service';
import { DisbursementsController } from './disbursements.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { OrphanagesModule } from '../orphanages/orphanages.module';

@Module({
  imports: [LedgerModule, OrphanagesModule],
  providers: [DisbursementsService],
  controllers: [DisbursementsController],
  exports: [DisbursementsService],
})
export class DisbursementsModule {}
