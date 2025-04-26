import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateActionDto } from './dto/create-action.dto';
import { UpdateActionDto } from './dto/update-action.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Action } from './entities/action.entity';
import { Repository } from 'typeorm';
import { UserService } from 'src/user/user.service';

@Injectable()
export class ActionsService {
  constructor(
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
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

  async joinAction(id: number, email: string): Promise<Action | null> {
    const action = await this.findOne(id);
    const user = await this.userService.findOneByEmail(email);
    if (!action) {
      throw new NotFoundException('Action not found');
    }
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return action;
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
