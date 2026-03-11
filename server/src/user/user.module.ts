import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImagesModule } from 'src/images/images.module';
import { MessagingModule } from 'src/messaging/messaging.module';
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
import { Tag } from './entities/tag.entity';
import { OnetimeInvite } from './entities/onetime-invite.entity';
import { UserAwayRange } from './entities/user-away-range.entity';
import { Community } from 'src/community/entities/community.entity';
import { CommunityInvite } from 'src/community/entities/community-invite.entity';
import { ContractEvent } from './entities/contract-event.entity';
import { PushModule } from 'src/push/push.module';
import { UserDevice } from './entities/user-device.entity';
import { EventLogModule } from 'src/eventlog/eventlog.module';
import { NotifsModule } from 'src/notifs/notifs.module';
import { CommunityModule } from 'src/community/community.module';
import { LiveActivityRegistration } from 'src/apns/entities/live-activity-registration.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Action,
      ActionActivity,
      City,
      Community,
      CommunityInvite,
      ContractEvent,
      Friend,
      Notification,
      OnetimeInvite,
      PrefillUser,
      Tag,
      UserDevice,
      UserAwayRange,
      LiveActivityRegistration,
    ]),
    JwtModule,
    ImagesModule,
    MailModule,
    forwardRef(() => MessagingModule),
    PushModule,
    forwardRef(() => EventLogModule),
    forwardRef(() => NotifsModule),
    forwardRef(() => CommunityModule),
  ],
  controllers: [UserController],
  providers: [UserService, IsUserAlreadyExist],
  exports: [UserService],
})
export class UserModule {
  constructor(private readonly userService: UserService) {}
}
