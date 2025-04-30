import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateActionDto, UpdateActionDto } from './dto/action.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Action } from './entities/action.entity';
import { Repository } from 'typeorm';
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

  findOne(id: number): Promise<Action | null> {
    return this.actionRepository.findOneBy({ id });
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

  async joinAction(actionId: number, userId: number): Promise<UserAction> {
    return this.setActionRelation(actionId, userId, UserActionRelation.JOINED);
  }

  async completeAction(actionId: number, userId: number): Promise<UserAction> {
    return this.setActionRelation(
      actionId,
      userId,
      UserActionRelation.COMPLETED,
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
