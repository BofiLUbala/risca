import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentsService } from './payments.service';
import { LedgerService } from '../ledger/ledger.service';

@Injectable()
export class PaymentsScheduler {
  private readonly logger = new Logger('PaymentsScheduler');

  constructor(
    private payments: PaymentsService,
    private ledger: LedgerService,
  ) {}

  /** Echeances mensuelles des parrainages. */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async charges() {
    if (process.env.DISABLE_SCHEDULERS === 'true') return;
    const r = await this.payments.runRecurringCharges();
    if (r.due > 0) this.logger.log(`Parrainages : ${r.charged} preleves, ${r.failed} echoues, ${r.ended} termines`);
  }

  /** Rapprochement quotidien des comptes (section 10.4). */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async reconcile() {
    if (process.env.DISABLE_SCHEDULERS === 'true') return;
    const r = await this.ledger.reconcile();
    if (!r.balanced) {
      this.logger.error(`Rapprochement : ${r.discrepancies.length} ecart(s) detecte(s)`);
    }
  }
}
