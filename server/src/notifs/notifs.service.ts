import {
    Injectable,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MailService } from 'src/mail/mail.service';
import { MmsService } from 'src/mms/mms.service';
import { User } from 'src/user/user.entity';
import { Repository } from 'typeorm';
import { ActionEventNotif } from './entities/action-event-notif.entity';
import { Notification } from './entities/notification.entity';
import { NotificationChannel } from './notifchannel';

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
      where: { user: { id: userId } },
      relations: ['user', 'associatedUser'],
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
      relations: ['user'],
    });
    if (!notif) {
      throw new NotFoundException('Notif not found');
    }
    if (notif.user.id !== userId) {
      throw new UnauthorizedException();
    }
    return this.notifsRepository.update(id, { read: true });
  }

  async setReadAll(userId: number) {
    return this.notifsRepository.update(
      { user: { id: userId }, cleared: false },
      { read: true },
    );
  }

  async clear(userId: number) {
    return this.notifsRepository.update(
      { user: { id: userId }, cleared: false },
      { cleared: true },
    );
  }

  shouldEmailUser(user: User) {
    return user.emailNotifsEnabled && !user.turnedOffAllNotifs && user.contractDateSigned;
  }

  shouldTextUser(user: User) {
    return (
      user.textNotifsEnabled && !user.turnedOffAllNotifs && user.phoneNumber && user.contractDateSigned
    );
  }

  async notifsForEvent(id: number) {
    return this.actionEventNotifsRepository.find({
      where: { actionEvent: { id } },
      relations: ['user', 'mail', 'mms'],
    });
  }

  async reloadNotifDataForEvent(id: number) {
    const notifs = await this.notifsForEvent(id);
    for (const notif of notifs) {
      if (notif.channel === NotificationChannel.Text) {
        const mms = notif.mms;
        if (!mms) {
          continue;
        }
        notif.mms = await this.mmsService.refreshMmsData(mms);
        await this.actionEventNotifsRepository.save(notif);
      }
      if (notif.channel === NotificationChannel.Email) {
        //TODO: refresh mail data
      }
    }
  }
}
