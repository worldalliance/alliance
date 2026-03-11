import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LiveActivityRegistration } from './entities/live-activity-registration.entity';
import { ApnsService } from './apns.service';
import { Action } from 'src/actions/entities/action.entity';

@Injectable()
export class LiveActivityService {
  private readonly logger = new Logger(LiveActivityService.name);

  constructor(
    @InjectRepository(LiveActivityRegistration)
    private readonly registrationRepository: Repository<LiveActivityRegistration>,
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    private readonly apnsService: ApnsService,
  ) {}

  async updateCompletionCount(actionId: number): Promise<void> {
    const action = await this.actionRepository.findOne({
      where: { id: actionId },
    });
    if (!action) return;

    const registrations = await this.registrationRepository.find({
      where: {
        actionId,
        ended: false,
      },
    });

    const currentCount = action.usersCompleted;

    for (const reg of registrations) {
      if (!reg.updateToken) continue;
      if (reg.lastCompletedCountSent === currentCount) continue;

      try {
        await this.apnsService.sendUpdate(reg.updateToken, {
          completedCount: currentCount,
        });
        await this.registrationRepository.update(reg.id, {
          lastCompletedCountSent: currentCount,
        });
      } catch (err) {
        this.logger.error(
          `Failed to send LA update for registration ${reg.id}`,
          err,
        );
      }
    }
  }
}
