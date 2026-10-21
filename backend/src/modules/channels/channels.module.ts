import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChannelsService } from './channels.service';
import { ChannelsController } from './channels.controller';
import { ChannelsGateway } from './channels.gateway';

@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_SECRET })],
  providers: [ChannelsService, ChannelsGateway],
  controllers: [ChannelsController],
  exports: [ChannelsService, ChannelsGateway],
})
export class ChannelsModule {}
