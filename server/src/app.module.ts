import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user/user.entity';
import { ActionsModule } from './actions/actions.module';
import { Action } from './actions/entities/action.entity';
import { UserService } from './user/user.service';
import { UserAction } from './actions/entities/user-action.entity';
import { CommuniquesModule } from './communiques/communiques.module';
import { ImagesModule } from './images/images.module';
import { MulterModule } from '@nestjs/platform-express';
import { Image } from './images/entities/image.entity';
import { Communique } from './communiques/entities/communique.entity';
import { ForumModule } from './forum/forum.module';
import { Post } from './forum/entities/post.entity';
import { Reply } from './forum/entities/reply.entity';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Friend } from './user/friend.entity';
import { NotifsModule } from './notifs/notifs.module';
import { Notification } from './notifs/entities/notification.entity';
import { ActionEvent } from './actions/entities/action-event.entity';
import { GeoModule } from './geo/geo.module';
import { City } from './geo/city.entity';
import { MailModule } from './mail/mail.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { PugAdapter } from '@nestjs-modules/mailer/dist/adapters/pug.adapter';
import { MailService } from './mail/mail.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MailerModule.forRoot({
      transport: {
        host: 'email-smtp.us-west-2.amazonaws.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      },
      preview: {
        open: true,
      },
      defaults: {
        from: '"alliance" <no-reply@alliance.org>',
      },
      template: {
        dir: __dirname + '/mail/templates',
        adapter: new PugAdapter(),
        options: {
          strict: true,
        },
      },
    }),
    MulterModule.register({}),
    EventEmitterModule.forRoot(),
    AuthModule,
    UserModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT ?? '5432'),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [
        User,
        Action,
        UserAction,
        Image,
        Communique,
        Post,
        Reply,
        Notification,
        Friend,
        ActionEvent,
        City,
      ],
      synchronize: true, //process.env.NODE_ENV !== 'production',
      ...(process.env.NODE_ENV === 'production'
        ? {
            ssl: { rejectUnauthorized: false },
            extra: { ssl: { rejectUnauthorized: false } },
          }
        : {}),
    }),
    ActionsModule,
    CommuniquesModule,
    ImagesModule,
    ForumModule,
    NotifsModule,
    GeoModule,
    MailModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {
  constructor(
    private userService: UserService,
    private mailService: MailService,
  ) {
    void this.onModuleInit();
  }

  async onModuleInit() {
    if (process.env.ADMIN_USER) {
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
