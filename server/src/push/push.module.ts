import { Module, forwardRef } from '@nestjs/common';
import { PushService, EXPO_CLIENT } from './push.service';
import { PushController } from './push.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Push } from './push.entity';
import { UserDevice } from 'src/user/entities/user-device.entity';
import { NotifPushDispatcherWorker } from './notif-push-dispatcher.worker';
import { Notification } from 'src/notifs/entities/notification.entity';
import { NotifsModule } from 'src/notifs/notifs.module';
import { UnreadContent } from 'src/notifs/entities/unread-content.entity';
import { Expo } from 'expo-server-sdk';

@Module({
  imports: [
    TypeOrmModule.forFeature([Push, UserDevice, Notification, UnreadContent]),
    forwardRef(() => NotifsModule),
  ],
  controllers: [PushController],
  providers: [
    {
      provide: EXPO_CLIENT,
      useFactory: () =>
        new Expo({
          accessToken: process.env.EXPO_ACCESS_TOKEN,
          useFcmV1: true,
        }),
    },
    PushService,
    NotifPushDispatcherWorker,
  ],
  exports: [PushService],
})
export class PushModule {}
