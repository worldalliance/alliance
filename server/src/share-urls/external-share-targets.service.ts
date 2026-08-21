import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "src/utils/Repository";
import {
  CreateExternalShareTargetDto,
  UpdateExternalShareTargetDto,
} from "./dto/external-share-target.dto";
import { ExternalShareTarget } from "./entities/external-share-target.entity";
import { ShareUrlsService } from "./share-urls.service";

@Injectable()
export class ExternalShareTargetsService {
  constructor(
    @InjectRepository(ExternalShareTarget)
    private readonly repository: Repository<ExternalShareTarget>,
    private readonly shareUrlsService: ShareUrlsService,
  ) {}

  async findAll(): Promise<ExternalShareTarget[]> {
    return this.repository.find({ order: { createdAt: "DESC" } });
  }

  async findOne(id: number): Promise<ExternalShareTarget> {
    const target = await this.repository.findOne({ where: { id } });
    if (!target) {
      throw new NotFoundException("External share target not found");
    }
    return target;
  }

  async create(
    dto: CreateExternalShareTargetDto,
  ): Promise<ExternalShareTarget> {
    const target = this.repository.create(dto);
    return this.repository.save(target);
  }

  async update(
    id: number,
    dto: UpdateExternalShareTargetDto,
  ): Promise<ExternalShareTarget> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException("No fields to update");
    }
    return this.repository.manager.transaction(async (m) => {
      const existing = await m.findOne(ExternalShareTarget, {
        where: { id },
        lock: { mode: "pessimistic_write" },
      });
      if (!existing) {
        throw new NotFoundException("External share target not found");
      }
      await m.update(ExternalShareTarget, id, dto);
      const updated = await m.findOneOrFail(ExternalShareTarget, {
        where: { id },
      });
      if (
        updated.url !== existing.url ||
        updated.paramName !== existing.paramName
      ) {
        await this.shareUrlsService.recomputeUrlsForExternalTarget(updated, m);
      }
      return updated;
    });
  }

  async remove(id: number): Promise<void> {
    const result = await this.repository.delete(id);
    if (!result.affected) {
      throw new NotFoundException("External share target not found");
    }
  }
}
