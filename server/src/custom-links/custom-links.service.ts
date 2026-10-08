import { customLinkFieldsSchema } from "@alliance/common/customLinks";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { isUniqueViolation } from "src/utils/db-errors";
import type { Repository } from "src/utils/Repository";
import {
  CreateCustomLinkDto,
  UpdateCustomLinkDto,
} from "./dto/custom-link.dto";
import { CustomLink } from "./entities/custom-link.entity";

const PATH_CONFLICT_MESSAGE = "That custom path already exists.";

@Injectable()
export class CustomLinksService {
  constructor(
    @InjectRepository(CustomLink)
    private readonly repository: Repository<CustomLink>,
  ) {}

  findAll(): Promise<CustomLink[]> {
    return this.repository.find({ order: { createdAt: "DESC" } });
  }

  async create(dto: CreateCustomLinkDto): Promise<CustomLink> {
    const parsed = customLinkFieldsSchema.safeParse(dto);
    if (!parsed.success)
      throw new BadRequestException(
        parsed.error.issues.map((issue) => issue.message),
      );
    try {
      return await this.repository.save(this.repository.create(parsed.data));
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException(PATH_CONFLICT_MESSAGE);
      throw error;
    }
  }

  async update(id: number, dto: UpdateCustomLinkDto): Promise<CustomLink> {
    const parsed = customLinkFieldsSchema.partial().safeParse(dto);
    if (!parsed.success)
      throw new BadRequestException(
        parsed.error.issues.map((issue) => issue.message),
      );
    if (Object.keys(parsed.data).length === 0)
      throw new BadRequestException("No fields to update");
    try {
      return await this.repository.manager.transaction(async (manager) => {
        const link = await manager.findOne(CustomLink, {
          where: { id },
          lock: { mode: "pessimistic_write" },
        });
        if (!link) throw new NotFoundException("Custom link not found");
        if (parsed.data.label !== undefined) link.label = parsed.data.label;
        if (parsed.data.slug !== undefined) link.slug = parsed.data.slug;
        if (parsed.data.destination !== undefined)
          link.destination = parsed.data.destination;
        return manager.save(link);
      });
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException(PATH_CONFLICT_MESSAGE);
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted.affected) throw new NotFoundException("Custom link not found");
  }

  async resolve(slug: string): Promise<Pick<CustomLink, "destination">> {
    return this.repository.manager.transaction(async (manager) => {
      const link = await manager.findOne(CustomLink, {
        where: { slug },
        lock: { mode: "pessimistic_write" },
      });
      if (!link) throw new NotFoundException("Custom link not found");
      await manager.increment(CustomLink, { id: link.id }, "visits", 1);
      return { destination: link.destination };
    });
  }
}
