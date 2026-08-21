import { MailerModule } from "@nestjs-modules/mailer";
import { PugAdapter } from "@nestjs-modules/mailer/adapters/pug.adapter";
import { Module, OnModuleInit } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { MulterModule } from "@nestjs/platform-express";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule } from "@nestjs/throttler";
import { TypeOrmModule } from "@nestjs/typeorm";
import multer from "multer";
import { ActionPartnershipsModule } from "./action-partnerships/action-partnerships.module";
import { ActionsModule } from "./actions/actions.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { ApnsModule } from "./apns/apns.module";
import { AppController } from "./app.controller";
import { AuthModule } from "./auth/auth.module";
import { CampaignModule } from "./campaign/campaign.module";
import { ClusterModule } from "./cluster/cluster.module";
import { CommunityModule } from "./community/community.module";
import { ContractModule } from "./contract/contract.module";
import { connectionOptions } from "./datasources/dataSource";
import { EventLogModule } from "./eventlog/eventlog.module";
import { ForumModule } from "./forum/forum.module";
import { GeoModule } from "./geo/geo.module";
import { ImagesModule } from "./images/images.module";
import { LikesModule } from "./likes/likes.module";
import { LinkPreviewModule } from "./link-preview/link-preview.module";
import { MailModule } from "./mail/mail.module";
import { MessagingModule } from "./messaging/messaging.module";
import { MmsModule } from "./mms/mms.module";
import { NotifsModule } from "./notifs/notifs.module";
import { PosthogModule } from "./posthog/posthog.module";
import { PushModule } from "./push/push.module";
import { S3Module } from "./s3/s3.module";
import { SearchModule } from "./search/search.module";
import { ShareUrlsModule } from "./share-urls/share-urls.module";
import { TasksModule } from "./tasks/tasks.module";
import { ReferralSource } from "./user/entities/user.entity";
import { UserModule } from "./user/user.module";
import { UserService } from "./user/user.service";
import { ALL_THROTTLERS } from "./utils/throttle";
import { VideosModule } from "./videos/videos.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MailerModule.forRoot({
      transport: {
        host: process.env.SMTP_HOST,
        port: 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      },
      template: {
        dir: __dirname + "/templates",
        adapter: new PugAdapter(),
        options: {
          strict: true,
        },
      },
    }),
    S3Module,
    MulterModule.register({
      storage: multer.memoryStorage(),
    }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot(ALL_THROTTLERS),
    PosthogModule,
    AuthModule,
    UserModule,
    CommunityModule,
    ContractModule,
    ClusterModule,
    TypeOrmModule.forRoot({ ...connectionOptions(), autoLoadEntities: true }),
    ScheduleModule.forRoot(),
    ActionsModule,
    ActionPartnershipsModule,
    ImagesModule,
    VideosModule,
    ForumModule,
    LikesModule,
    LinkPreviewModule,
    NotifsModule,
    GeoModule,
    MailModule,
    SearchModule,
    ShareUrlsModule,
    CampaignModule,
    TasksModule,
    MmsModule,
    AnalyticsModule,
    MessagingModule,
    PushModule,
    EventLogModule,
    ApnsModule,
  ],
  controllers: [AppController],
})
export class AppModule implements OnModuleInit {
  constructor(private userService: UserService) {}

  async onModuleInit() {
    if (process.env.ADMIN_USER && process.env.NODE_ENV !== "production") {
      const user = await this.userService.findOneByEmail(
        process.env.ADMIN_USER,
      );
      if (user) {
        await this.userService.setAdmin(user.id, true);
      } else {
        await this.userService.create({
          email: process.env.ADMIN_USER,
          password: process.env.ADMIN_PASSWORD,
          name: "Admin",
          admin: true,
          referralSource: ReferralSource.None,
        });
      }
    }
  }
}
