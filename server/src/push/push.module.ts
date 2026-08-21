import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Expo } from "expo-server-sdk";
import { Notification } from "src/notifs/entities/notification.entity";
import { UnreadContent } from "src/notifs/entities/unread-content.entity";
import { NotifsModule } from "src/notifs/notifs.module";
import { UserDevice } from "src/user/entities/user-device.entity";
import { NotifPushDispatcherWorker } from "./notif-push-dispatcher.worker";
import { PushController } from "./push.controller";
import { Push } from "./push.entity";
import { EXPO_CLIENT, PushService } from "./push.service";

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
