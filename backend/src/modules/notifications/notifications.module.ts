import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { DevicesService } from './devices.service';

@Module({
  controllers: [NotificationsController],
  providers: [DevicesService],
})
export class NotificationsModule {}
