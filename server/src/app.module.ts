import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActionsModule } from './actions/actions.module';
import { UserService } from './user/user.service';
import { CommuniquesModule } from './communiques/communiques.module';
import { ImagesModule } from './images/images.module';
import { MulterModule } from '@nestjs/platform-express';
import { ForumModule } from './forum/forum.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NotifsModule } from './notifs/notifs.module';
import { GeoModule } from './geo/geo.module';
import { MailModule } from './mail/mail.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { PugAdapter } from '@nestjs-modules/mailer/dist/adapters/pug.adapter';
import { connectionOptions } from './datasources/dataSource';

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
    TypeOrmModule.forRoot(connectionOptions()),
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
  constructor(private userService: UserService) {
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
