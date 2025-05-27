import { Injectable, NotFoundException } from '@nestjs/common';
import { ActionDto, CreateActionDto, UpdateActionDto, ActionEventDto } from './dto/action.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Action, ActionStatus } from './entities/action.entity';
import { ActionEvent, NotificationType } from './entities/action-event.entity';
import { In, Not, Repository } from 'typeorm';
import { UserService } from '../user/user.service';
import { UserAction, UserActionRelation } from './entities/user-action.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable } from 'rxjs';
import { from } from 'rxjs';

@Injectable()
export class ActionsService {
  constructor(
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(ActionEvent)
    private readonly actionEventRepository: Repository<ActionEvent>,
    @InjectRepository(UserAction)
    private readonly userActionRepository: Repository<UserAction>,
    private userService: UserService,
    public eventEmitter: EventEmitter2,
  ) {}

  async create(createActionDto: CreateActionDto): Promise<Action> {
    const action = this.actionRepository.create(createActionDto);
    return this.actionRepository.save(action);
  }

  findAll(): Promise<Action[]> {
    return this.actionRepository.find();
  }

  findPublic(): Promise<Action[]> {
    return this.actionRepository.find({
      where: { status: Not(ActionStatus.Draft) },
    });
  }

  async findPublicWithRelation(userId: number): Promise<ActionDto[]> {
    const qb = this.actionRepository
      .createQueryBuilder('action')
      .where('action.status <> :draft', { draft: ActionStatus.Draft });

    qb.leftJoinAndSelect(
      'action.userRelations',
      'ua',
      userId ? 'ua.userId = :userId' : '1=0', // 1=0 prevents a cartesian join when unauthenticated
      { userId },
    );

    const actions = await qb.getMany();

    return actions.map((action) => ({
      ...action,
      myRelation: action.userRelations[0] ?? null, // length 1 since filtered for the user
      usersJoined: action.usersJoined,
    }));
  }

  async findOne(id: number) {
    const action = await this.actionRepository.findOne({
      where: { id },
      relations: ['userRelations', 'updates'],
    });
    if (!action) {
      throw new NotFoundException('Action not found');
    }
    const usersJoined = action?.userRelations?.filter(
      (relation) =>
        relation.status === UserActionRelation.joined ||
        relation.status === UserActionRelation.completed,
    ).length;
    return { ...action, usersJoined };
  }

  async findOneWithRelation(
    id: number,
    userId: number,
  ): Promise<ActionDto | null> {
    const action = await this.findOne(id);
    const userAction = await this.getActionRelation(id, userId);
    return { ...action, myRelation: userAction };
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

    return this.userActionRepository.save(relation);
  }

  async completeAction(actionId: number, userId: number): Promise<UserAction> {
    return this.setActionRelation(
      actionId,
      userId,
      UserActionRelation.completed,
    );
  }

  async update(
    id: number,
    updateActionDto: UpdateActionDto,
  ): Promise<Action | null> {
    await this.actionRepository.update(id, updateActionDto);
    return this.findOne(id);
  }

  async addEvent(id: number, actionEventDto: ActionEventDto): Promise<Action> {
    const action = await this.findOne(id);

    const newEvent = this.actionEventRepository.create({
      message: actionEventDto.message,
      newStatus: actionEventDto.newStatus,
      sendNotifs: actionEventDto.sendNotifs as NotificationType,
      updateDate: new Date(),
      showInTimeline: actionEventDto.showInTimeline,
      action,
    });

    await this.actionEventRepository.save(newEvent);

    action.events.push(newEvent);
    await this.actionRepository.save(action);

    return action;
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
}
