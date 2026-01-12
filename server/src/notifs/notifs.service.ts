import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MailService } from 'src/mail/mail.service';
import { MmsService } from 'src/mms/mms.service';
import { User } from 'src/user/entities/user.entity';
import { IsNull, LessThan, Repository } from 'typeorm';
import { ActionEventNotif } from './entities/action-event-notif.entity';
import {
  Notification,
  NotificationCategory,
} from './entities/notification.entity';
import { NotifClickDto, NotifClickResponseDto } from './dto/notifclick.dto';
import { ActionUpdate } from 'src/actions/entities/action-update.entity';
import { actionUrl } from 'src/search/approutes';
import { NotificationChannel } from './notif-utils';

export function shouldEmailUser(user: User) {
  return (
    user.emailNotifsEnabled &&
    !user.turnedOffAllNotifs &&
    user.hasActiveContract
  );
}

export function shouldTextUser(user: User) {
  return (
    user.textNotifsEnabled &&
    !user.turnedOffAllNotifs &&
    user.phoneNumber &&
    user.hasActiveContract &&
    user.phoneNumberValidated &&
    user.preferredActionReminderChannel === NotificationChannel.Text
  );
}

export function shouldPushUser(user: User) {
  return (
    !user.turnedOffAllNotifs &&
    user.pushNotifsEnabled &&
    user.preferredActionReminderChannel === NotificationChannel.Push &&
    process.env.NODE_ENV === 'development'
  );
}

@Injectable()
export class NotifsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifsRepository: Repository<Notification>,
    @InjectRepository(ActionEventNotif)
    private readonly actionEventNotifsRepository: Repository<ActionEventNotif>,
    private readonly mailService: MailService,
    private readonly mmsService: MmsService,
  ) {}

  async findAll(userId: number) {
    const notifs = await this.notifsRepository.find({
      where: { user: { id: userId }, sendTime: LessThan(new Date()) },
      relations: { associatedUsers: true },
    });
    return notifs;
  }

  findOne(id: number) {
    return this.notifsRepository.findOne({
      where: { id },
    });
  }

  async setRead(id: number, userId: number) {
    const notif = await this.notifsRepository.findOne({
      where: { id, user: { id: userId } },
      relations: { user: true },
    });
    if (!notif) {
      throw new NotFoundException('Notif not found');
    }
    if (notif.user.id !== userId) {
      throw new UnauthorizedException();
    }
    return this.notifsRepository.update(
      { id: id, readAt: IsNull() },
      { readAt: new Date() },
    );
  }

  async setReadAll(userId: number) {
    return this.notifsRepository.update(
      { user: { id: userId }, readAt: IsNull() },
      { readAt: new Date() },
    );
  }

  async notifsForUser(id: number) {
    return this.actionEventNotifsRepository.find({
      where: { user: { id } },
      relations: {
        user: true,
        mail: true,
        mms: true,
      },
    });
  }

  async notifLinkClick(body: NotifClickDto): Promise<NotifClickResponseDto> {
    const mms = await this.mmsService.setClickedLinkByCid(body.cid);
    if (mms) {
      return { mms: true };
    }
    await this.mailService.setClickedLinkByCid(body.cid);
    return { mms: false };
  }

  async createActionUpdateNotif(actionUpdate: ActionUpdate, user: User) {
    const notif = this.notifsRepository.create({
      user,
      actionUpdate,
      category: NotificationCategory.ActionUpdate,
      message: actionUpdate.shortNotifString,
      webAppLocation: actionUrl(actionUpdate.action.id),
      mobileAppLocation: actionUrl(actionUpdate.action.id),
      sendTime: actionUpdate.date,
    });
    return this.notifsRepository.save(notif);
  }
}
