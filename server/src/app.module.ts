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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MulterModule.register({}),
    AuthModule,
    UserModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT ?? '5432'),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [User, Action, UserAction],
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
