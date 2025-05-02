import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Communique } from './entities/communique.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateCommuniqueDto, UpdateCommuniqueDto } from './dto/communique.dto';
import { UserService } from '../user/user.service';

@Injectable()
export class CommuniquesService {
  constructor(
    @InjectRepository(Communique)
    private communiqueRepository: Repository<Communique>,
    private userService: UserService,
  ) {}
  async findAll(): Promise<Communique[]> {
    return this.communiqueRepository.find();
  }

  async create(communique: CreateCommuniqueDto): Promise<Communique> {
    return this.communiqueRepository.save(communique);
  }

  async update(
    id: number,
    communique: UpdateCommuniqueDto,
  ): Promise<Communique> {
    await this.communiqueRepository.update(id, communique);
    const output = await this.findOne(id);
    if (!output) {
      throw new NotFoundException('Updated communique not found');
    }
    return output;
  }

  async findOne(id: number): Promise<Communique | null> {
    const communique = await this.communiqueRepository.findOne({
      where: { id },
      relations: ['usersRead'],
    });
    if (!communique) {
      console.log('Communique not found');
      return null;
    }
    return communique;
  }

  async setRead(userId: number, id: number) {
    const communique = await this.findOne(id);
    const user = await this.userService.findOne(userId);
    if (!communique || !user) {
      throw new BadRequestException('Communique or user not found');
    }
    if (!communique.usersRead) {
      communique.usersRead = [];
    }
    communique.usersRead.push(user);
    await this.communiqueRepository.save(communique);
  }

  async getRead(userId: number, id: number) {
    const communique = await this.findOne(id);
    const user = await this.userService.findOne(userId);
    if (!communique || !user) {
      throw new BadRequestException('Communique or user not found');
    }
    if (!communique.usersRead) {
      return false;
    }
    return communique.usersRead.some((user) => user.id === userId);
  }

  async remove(id: number): Promise<boolean> {
    const result = await this.communiqueRepository.delete(id);
    if (result.affected === 0) {
      return false;
    }
    return true;
  }
}
