import { Injectable } from '@nestjs/common';
import { CreateForumDto } from './dto/create-forum.dto';
import { UpdateForumDto } from './dto/update-forum.dto';

@Injectable()
export class ForumService {
  create(createForumDto: CreateForumDto) {
    return 'This action adds a new forum';
  }

  findAll() {
    return `This action returns all forum`;
  }

  findOne(id: number) {
    return `This action returns a #${id} forum`;
  }

  update(id: number, updateForumDto: UpdateForumDto) {
    return `This action updates a #${id} forum`;
  }

  remove(id: number) {
    return `This action removes a #${id} forum`;
  }
}
