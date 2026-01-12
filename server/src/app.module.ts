import { MailerModule } from '@nestjs-modules/mailer';
import { PugAdapter } from '@nestjs-modules/mailer/dist/adapters/pug.adapter';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MulterModule } from '@nestjs/platform-express';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as multer from 'multer';
import { ActionsModule } from './actions/actions.module';
import { AdminViewerModule } from './admin-viewer/admin-viewer.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { connectionOptions } from './datasources/dataSource';
import { ForumModule } from './forum/forum.module';
import { GeoModule } from './geo/geo.module';
import { ImagesModule } from './images/images.module';
import { MailModule } from './mail/mail.module';
import { MmsModule } from './mms/mms.module';
import { NotifsModule } from './notifs/notifs.module';
import { PaymentsModule } from './payments/payments.module';
import { S3Module } from './s3/s3.module';
import { SearchModule } from './search/search.module';
import { TasksModule } from './tasks/tasks.module';
import { UserModule } from './user/user.module';
import { UserService } from './user/user.service';
import { MessagingModule } from './messaging/messaging.module';
import { PushModule } from './push/push.module';
import { SlackModule } from './slack/slack.module';

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
        dir: __dirname + '/templates',
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
    AuthModule,
    UserModule,
    TypeOrmModule.forRoot(connectionOptions()),
    ScheduleModule.forRoot(),
    ActionsModule,
    ImagesModule,
    ForumModule,
    NotifsModule,
    GeoModule,
    MailModule,
    PaymentsModule,
    AdminViewerModule,
    SearchModule,
    TasksModule,
    MmsModule,
    AnalyticsModule,
    MessagingModule,
    PushModule,
    SlackModule,
  ],
  controllers: [AppController],
})
export class AppModule {
  constructor(private userService: UserService) {
    void this.onModuleInit();
  }

  async onModuleInit() {
    if (process.env.ADMIN_USER && process.env.NODE_ENV !== 'production') {
      const user = await this.userService.findOneByEmail(
        process.env.ADMIN_USER,
      );
      if (user) {
        await this.userService.setAdmin(user.id, true);
      } else {
        await this.userService.create({
          email: process.env.ADMIN_USER,
          password: process.env.ADMIN_PASSWORD,
          name: 'Admin',
          admin: true,
        });
      }
    }
  }
}
