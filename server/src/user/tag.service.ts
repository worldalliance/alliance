import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { softDeleteWhere, writeUnderLive } from "src/datasources/soft-delete";
import { DataSource, type Repository } from "typeorm";
import { CreateTagDto } from "./dto/tag.dto";
import { loadedTagUsers, Tag } from "./entities/tag.entity";
import { User } from "./entities/user.entity";
import { UserService } from "./user.service";

@Injectable()
export class TagService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
    private readonly userService: UserService,
  ) {}

  async createTag(body: CreateTagDto): Promise<Tag> {
    const tag = this.tagRepository.create({ ...body, users: [] });
    return this.tagRepository.save(tag);
  }

  async findAllTags(): Promise<Tag[]> {
    return this.tagRepository.find({ relations: { users: true } });
  }

  async findAllTagSummaries(): Promise<Tag[]> {
    return this.tagRepository.find();
  }

  async findTagOrFail(id: string): Promise<Tag> {
    return this.tagRepository.findOneOrFail({
      where: { id },
      relations: { users: { contractEvents: true } },
    });
  }

  async addUserToTag(tagId: string, userId: number): Promise<Tag> {
    const tag = await this.tagRepository.findOneOrFail({
      where: { id: tagId },
      relations: { users: true },
    });
    tag.users = [
      ...loadedTagUsers(tag),
      await this.userService.findOneOrFail(userId),
    ];
    return writeUnderLive(this.dataSource.manager, {
      parents: [
        { target: Tag, id: tagId },
        { target: User, id: userId },
      ],
      write: (em) => em.save(tag),
    });
  }

  async removeUserFromTag(tagId: string, userId: number): Promise<Tag> {
    const tag = await this.tagRepository.findOneOrFail({
      where: { id: tagId },
      relations: { users: true },
    });
    tag.users = loadedTagUsers(tag).filter((user) => user.id !== userId);
    return this.tagRepository.save(tag);
  }

  async updateTag(tagId: string, body: CreateTagDto): Promise<Tag> {
    const tag = await this.tagRepository.findOneOrFail({
      where: { id: tagId },
    });
    Object.assign(tag, body);
    await this.tagRepository.save(tag);
    return this.tagRepository.findOneOrFail({
      where: { id: tagId },
      relations: { users: true },
    });
  }

  async deleteTag(tagId: string): Promise<void> {
    await softDeleteWhere(this.tagRepository.manager, {
      target: Tag,
      where: { id: tagId },
    });
  }
}
