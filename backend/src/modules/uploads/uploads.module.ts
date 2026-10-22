import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { AntivirusService } from './antivirus.service';

@Module({
  controllers: [UploadsController],
  providers: [AntivirusService],
})
export class UploadsModule {}
