import { Module, OnModuleInit } from '@nestjs/common';
import { UserService } from './user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Action } from '../actions/entities/action.entity';
import { IsUserAlreadyExist } from './validators/user-already-exists.validator';
import { UserAction } from '../actions/entities/user-action.entity';
import { Communique } from '../communiques/entities/communique.entity';
import { UserController } from './user.controller';
import { Friend } from './friend.entity';
import { City } from '../geo/city.entity';
import { Notification } from '../notifs/entities/notification.entity';
import { PrefillUser } from './prefill-user.entity';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    TypeOrmModule.forFeature([Action]),
    TypeOrmModule.forFeature([UserAction]),
    TypeOrmModule.forFeature([Communique]),
    TypeOrmModule.forFeature([Friend]),
    TypeOrmModule.forFeature([City]),
    TypeOrmModule.forFeature([Notification]),
    TypeOrmModule.forFeature([PrefillUser]),
    JwtModule,
  ],
  controllers: [UserController],
  providers: [UserService, IsUserAlreadyExist],
  exports: [UserService],
})
export class UserModule implements OnModuleInit {
  constructor(private readonly userService: UserService) {}

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
