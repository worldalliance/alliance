import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ActionDto,
  ActionWithRelationDto,
  CreateActionDto,
  UpdateActionDto,
  LatLonDto,
  CreateActionEventDto,
  ActionActivityDto,
} from './dto/action.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Action } from './entities/action.entity';
import {
  ActionEvent,
  NotificationType,
  ActionStatus,
} from './entities/action-event.entity';
import { In, Repository } from 'typeorm';
import { UserService } from '../user/user.service';
import { UserAction, UserActionRelation } from './entities/user-action.entity';
import {
  ActionActivity,
  ActionActivityType,
} from './entities/action-activity.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable } from 'rxjs';
import { from } from 'rxjs';
import { instanceToPlain } from 'class-transformer';

@Injectable()
export class ActionsService {
  constructor(
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(ActionEvent)
    private readonly actionEventRepository: Repository<ActionEvent>,
    @InjectRepository(UserAction)
    private readonly userActionRepository: Repository<UserAction>,
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    private userService: UserService,
    public eventEmitter: EventEmitter2,
  ) {}

  async create(createActionDto: CreateActionDto): Promise<Action> {
    const action = this.actionRepository.create(createActionDto);
    return this.actionRepository.save(action);
  }

  findAll(): Promise<ActionDto[]> {
    return this.actionRepository
      .find({
        relations: ['userRelations', 'events'],
      })
      .then((actions) => {
        return actions.map((action) => this.entityToDto(action));
      });
  }

  entityToDto(action: Action): ActionDto {
    return {
      ...action,
      usersJoined: action.usersJoined,
      usersCompleted: action.usersCompleted,
      status: action.status,
    };
  }

  findPublic(): Promise<ActionDto[]> {
    return this.actionRepository
      .find({
        relations: ['userRelations', 'events'],
      })
      .then((actions) => {
        return actions
          .filter((action) => action.status !== ActionStatus.Draft)
          .map((action) => this.entityToDto(action));
      });
  }

  async findPublicWithRelation(userId: number): Promise<ActionDto[]> {
    const qb = this.actionRepository
      .createQueryBuilder('action')
      .leftJoinAndSelect('action.events', 'events')
      .leftJoinAndSelect(
        'action.userRelations',
        'ua',
        userId ? 'ua.userId = :userId' : '1=0', // 1=0 prevents a cartesian join when unauthenticated
        { userId },
      );

    const actions = await qb.getMany();

    return actions
      .filter((action) => action.status !== ActionStatus.Draft)
      .map((action) => ({
        ...this.entityToDto(action),
        myRelation: action.userRelations[0] ?? null, // length 1 since filtered for the user
      }));
  }

  async findOne(id: number): Promise<Action> {
    const action = await this.actionRepository.findOne({
      where: { id },
      relations: ['userRelations', 'events'],
    });
    if (!action) {
      throw new NotFoundException('Action not found');
    }
    return instanceToPlain(action) as Action;
  }

  async findOneWithRelation(
    id: number,
    userId: number,
  ): Promise<ActionDto | null> {
    const action = await this.findOne(id);
    const userAction = await this.getActionRelation(id, userId);
    return {
      ...this.entityToDto(action),
      myRelation: userAction,
    };
  }

  async setActionRelation(
    actionId: number,
    userId: number,
    status: UserActionRelation,
  ): Promise<UserAction> {
    const action = await this.findOne(actionId);
    const user = await this.userService.findOne(userId);
    if (!action || !user) {
      throw new NotFoundException('Action or user not found');
    }
    let userAction = await this.userActionRepository.findOne({
      where: { user: { id: userId }, action: { id: actionId } },
      relations: ['user', 'action'],
    });

    if (!userAction) {
      userAction = this.userActionRepository.create({
        user,
        action,
        status,
      });
    } else {
      userAction.status = status;
    }

    return await this.userActionRepository.save(userAction);
  }

  async getActionRelation(
    actionId: number,
    userId: number,
  ): Promise<UserAction | null> {
    let userAction = await this.userActionRepository.findOne({
      where: { action: { id: actionId }, user: { id: userId } },
    });
    if (!userAction) {
      console.log('no userAction found, setting to none');
      userAction = await this.setActionRelation(
        actionId,
        userId,
        UserActionRelation.none,
      );
    }
    return userAction;
  }

  async joinAction(actionId: number, userId: number): Promise<UserAction> {
    const default_days = 3;

    const relation = await this.setActionRelation(
      actionId,
      userId,
      UserActionRelation.joined,
    );
    relation.dateCommitted = new Date();
    relation.deadline = new Date(
      Date.now() + 1000 * 60 * 60 * 24 * default_days,
    );
    this.eventEmitter.emit('action.delta', { actionId, delta: +1 });

    // Create activity record for user joining
    const activity = this.actionActivityRepository.create({
      type: ActionActivityType.USER_JOINED,
      actionId: actionId,
      userId: userId,
    });
    await this.actionActivityRepository.save(activity);

    const result = await this.userActionRepository.save(relation);

    await this.checkAndProcessAutomaticTransitions(actionId);

    return result;
  }

  async completeAction(actionId: number, userId: number): Promise<UserAction> {
    const relation = await this.setActionRelation(
      actionId,
      userId,
      UserActionRelation.completed,
    );

    // Create activity record for user completing
    const activity = this.actionActivityRepository.create({
      type: ActionActivityType.USER_COMPLETED,
      actionId,
      userId,
    });
    await this.actionActivityRepository.save(activity);

    await this.checkAndProcessAutomaticTransitions(actionId);

    return relation;
  }

  async update(
    id: number,
    updateActionDto: UpdateActionDto,
  ): Promise<Action | null> {
    await this.actionRepository.update(id, updateActionDto);
    return this.findOne(id);
  }

  async addEvent(
    actionId: number,
    actionEventDto: CreateActionEventDto,
  ): Promise<ActionDto> {
    const action = await this.findOne(actionId);

    const newEvent = this.actionEventRepository.create({
      ...actionEventDto,
      action,
    });

    await this.actionEventRepository.save(newEvent);

    // re-fetch action from database to get the updated events
    const newAction = await this.findOne(actionId);

    return new ActionDto(newAction);
  }

  async remove(id: number) {
    await this.actionRepository.delete(id);
  }

  countCommitted(actionId: number): Observable<number> {
    return from(
      this.userActionRepository.count({
        where: {
          action: { id: actionId },
          status: In(['joined', 'completed']),
        },
      }),
    );
  }

  async countCommittedBulk(ids: number[]): Promise<Record<number, number>> {
    if (!ids.length) return {};

    const rows = await this.userActionRepository
      .createQueryBuilder('ua')
      .select('ua.actionId', 'id')
      .addSelect('COUNT(*)', 'count')
      .where('ua.actionId IN (:...ids)', { ids })
      .andWhere('ua.status IN (:...statuses)', {
        statuses: ['joined', 'completed'],
      })
      .groupBy('ua.actionId')
      .getRawMany<{ id: string; count: string }>();

    const map: Record<number, number> = {};
    rows.forEach((r) => (map[+r.id] = +r.count));
    ids.forEach((id) => (map[id] ??= 0));
    return map;
  }

  async findCompletedForUser(userId: number): Promise<ActionWithRelationDto[]> {
    const userActions = await this.userActionRepository.find({
      where: { user: { id: userId }, status: UserActionRelation.completed },
      relations: ['action', 'user'],
    });
    return userActions.map((ua) => ({
      ...ua.action,
      relation: ua,
      usersJoined: ua.action.usersJoined,
      usersCompleted: ua.action.usersCompleted,
      status: ua.action.status,
    }));
  }

  async userCoordinatesForAction(actionId: number): Promise<LatLonDto[]> {
    const userActions = await this.userActionRepository.find({
      where: {
        action: { id: actionId },
        status: In([UserActionRelation.joined, UserActionRelation.completed]),
      },
      relations: ['user', 'user.city'],
    });
    return userActions
      .filter(
        (
          ua,
        ): ua is typeof ua & {
          user: { city: NonNullable<typeof ua.user.city> };
        } => ua.user.city !== null,
      )
      .map((ua) => ({
        latitude: ua.user.city.latitude,
        longitude: ua.user.city.longitude,
      }));
  }

  async getActionActivities(actionId: number): Promise<ActionActivityDto[]> {
    return this.actionActivityRepository.find({
      where: { actionId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async checkAndProcessAutomaticTransitions(actionId: number) {
    const action = await this.findOne(actionId);

    // Check if we should transition from GatheringCommitments to CommitmentsReached
    if (action.status === ActionStatus.GatheringCommitments) {
      if (
        action.commitmentThreshold &&
        action.usersJoined >= action.commitmentThreshold
      ) {
        await this.createAutomaticTransitionEvent(
          actionId,
          ActionStatus.CommitmentsReached,
          'Commitment threshold reached',
          `${action.usersJoined} people have committed to this action, meeting the threshold of ${action.commitmentThreshold}.`,
        );
      }
    }

    // Check if we should transition from MemberAction to Resolution
    if (action.status === ActionStatus.MemberAction) {
      if (
        action.usersJoined > 0 &&
        action.usersCompleted >= action.usersJoined
      ) {
        await this.createAutomaticTransitionEvent(
          actionId,
          ActionStatus.Resolution,
          'All members completed action',
          `All ${action.usersJoined} committed members have completed the action.`,
        );
      }
    }
  }

  private async createAutomaticTransitionEvent(
    actionId: number,
    newStatus: ActionStatus,
    title: string,
    description: string,
  ): Promise<void> {
    const action = await this.findOne(actionId);

    const eventData: CreateActionEventDto = {
      title,
      description,
      newStatus,
      sendNotifsTo: NotificationType.Joined, // Notify users who joined the action
      date: new Date(), // Set to current time for immediate transition
      showInTimeline: true,
    };

    const newEvent = this.actionEventRepository.create({
      ...eventData,
      action,
    });

    await this.actionEventRepository.save(newEvent);
  }
}
