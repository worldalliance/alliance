import { Injectable, NotFoundException } from '@nestjs/common';
import { Communique } from './entities/communique.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateCommuniqueDto } from './dto/create-communique.dto';
import { UpdateCommuniqueDto } from './dto/update-communique.dto';
@Injectable()
export class CommuniquesService {
  constructor(
    @InjectRepository(Communique)
    private CommuniqueRepository: Repository<Communique>,
  ) {}
  async findAll(): Promise<Communique[]> {
    return this.CommuniqueRepository.find();
  }

  async create(communique: CreateCommuniqueDto): Promise<Communique> {
    return this.CommuniqueRepository.save(communique);
  }

  async update(
    id: number,
    communique: UpdateCommuniqueDto,
  ): Promise<Communique> {
    await this.CommuniqueRepository.update(id, communique);
    const output = await this.findOne(id);
    if (!output) {
      throw new NotFoundException('Updated communique not found');
    }
    return output;
  }

  async findOne(id: number): Promise<Communique | null> {
    const Communique = await this.CommuniqueRepository.findOneBy({ id });
    if (!Communique) {
      console.log('Communique not found');
      return null;
    }
    return Communique;
  }

  async remove(id: number): Promise<boolean> {
    const result = await this.CommuniqueRepository.delete(id);
    if (result.affected === 0) {
      return false;
    }
    return true;
  }
}
