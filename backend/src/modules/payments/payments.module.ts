import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { ProvidersService } from './providers.service';
import { ReceiptsService } from './receipts.service';
import { PaymentsScheduler } from './payments.scheduler';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [LedgerModule],
  providers: [PaymentsService, ProvidersService, ReceiptsService, PaymentsScheduler],
  controllers: [PaymentsController],
  exports: [PaymentsService, ProvidersService],
})
export class PaymentsModule {}
