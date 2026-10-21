import { Module } from '@nestjs/common';
import { OrphanagesService } from './orphanages.service';
import { OrphanagesController } from './orphanages.controller';
import { ApprovalsModule } from '../approvals/approvals.module';

@Module({
  imports: [ApprovalsModule],
  providers: [OrphanagesService],
  controllers: [OrphanagesController],
  exports: [OrphanagesService],
})
export class OrphanagesModule {}
