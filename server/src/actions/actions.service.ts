import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateActionDto, UpdateActionDto } from './dto/action.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Action, ActionStatus } from './entities/action.entity';
import { Not, Repository } from 'typeorm';
import { UserService } from '../user/user.service';
import { UserAction, UserActionRelation } from './entities/user-action.entity';

@Injectable()
export class ActionsService {
  constructor(
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(UserAction)
    private readonly userActionRepository: Repository<UserAction>,
    private userService: UserService,
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

  async findOne(id: number): Promise<Action | null> {
    const action = await this.actionRepository.findOne({
      where: { id },
      relations: ['userRelations'],
    });
    if (!action) {
      throw new NotFoundException('Action not found');
    }
    const usersJoined = action?.userRelations?.length || 0;
    return { ...action, usersJoined };
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
    return this.setActionRelation(actionId, userId, UserActionRelation.joined);
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

  async remove(id: number) {
    await this.actionRepository.delete(id);
  }
}
