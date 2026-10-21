import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ApprovalsService } from './approvals.service';

/** Rappels et remontee automatique des validations en retard (section 7.3). */
@Injectable()
export class ApprovalsScheduler {
  private readonly logger = new Logger('ApprovalsScheduler');

  constructor(private approvals: ApprovalsService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleOverdue() {
    if (process.env.DISABLE_SCHEDULERS === 'true') return;
    const result = await this.approvals.escalateOverdue();
    if (result.escalated > 0) {
      this.logger.log(`${result.escalated} validation(s) remontee(s) au niveau superieur`);
    }
  }
}
