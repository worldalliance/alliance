import { Module } from '@nestjs/common';
import { NotifsService } from './notifs.service';
import { NotifsController } from './notifs.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  controllers: [NotifsController],
  providers: [NotifsService],
})
export class NotifsModule {}
