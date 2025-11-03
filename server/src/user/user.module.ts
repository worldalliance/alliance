import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImagesModule } from 'src/images/images.module';
import { MailModule } from 'src/mail/mail.module';
import { ActionActivity } from '../actions/entities/action-activity.entity';
import { Action } from '../actions/entities/action.entity';
import { City } from '../geo/city.entity';
import { Notification } from '../notifs/entities/notification.entity';
import { Friend } from './entities/friend.entity';
import { PrefillUser } from './entities/prefill-user.entity';
import { UserController } from './user.controller';
import { User } from './entities/user.entity';
import { UserService } from './user.service';
import { IsUserAlreadyExist } from './validators/user-already-exists.validator';
import { Group } from './entities/group.entity';
import { OnetimeInvite } from './entities/onetime-invite.entity';
import { UserAwayRange } from './entities/user-away-range.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Action,
      ActionActivity,
      Friend,
      City,
      Notification,
      PrefillUser,
      Group,
      OnetimeInvite,
      UserAwayRange,
    ]),
    JwtModule,
    ImagesModule,
    MailModule,
  ],
  controllers: [UserController],
  providers: [UserService, IsUserAlreadyExist],
  exports: [UserService],
})
export class UserModule {
  constructor(private readonly userService: UserService) {}
}
