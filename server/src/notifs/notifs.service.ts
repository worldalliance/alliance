import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { Repository } from 'typeorm';

@Injectable()
export class NotifsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifsRepository: Repository<Notification>,
  ) {}

  async findAll(userId: number) {
    const notifs = await this.notifsRepository.find({
      where: { user: { id: userId } },
      relations: ['user'],
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
}
