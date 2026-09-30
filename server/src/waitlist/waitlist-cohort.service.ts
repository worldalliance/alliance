import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { isUniqueViolation } from "src/utils/db-errors";
import type { Repository } from "src/utils/Repository";
import { In } from "typeorm";
import {
  type CreateWaitlistCohortDto,
  parseCohortFilter,
  type ParsedWaitlistCohort,
  type UpdateWaitlistCohortDto,
} from "./dto/waitlist-cohort.dto";
import { WaitlistCohort } from "./entities/waitlist-cohort.entity";
import { WaitlistTag } from "./entities/waitlist-tag.entity";

const parse = (cohort: WaitlistCohort): ParsedWaitlistCohort => ({
  cohort,
  filter: parseCohortFilter(cohort.filter),
});

@Injectable()
export class WaitlistCohortService {
  constructor(
    @InjectRepository(WaitlistCohort)
    private readonly cohortRepository: Repository<WaitlistCohort>,
  ) {}

  async findAll(): Promise<ParsedWaitlistCohort[]> {
    const cohorts = await this.cohortRepository.find({
      order: { name: "ASC" },
    });
    return cohorts.map(parse);
  }

  private async findOne(id: number): Promise<WaitlistCohort> {
    const cohort = await this.cohortRepository.findOneBy({ id });
    if (!cohort) {
      throw new NotFoundException("Waitlist cohort not found");
    }
    return cohort;
  }

  /**
   * Refuses a filter naming a missing tag. Share-locking its tags keeps
   * `WaitlistTagService.delete` from removing one while the cohort saves.
   */
  private async save(cohort: WaitlistCohort): Promise<ParsedWaitlistCohort> {
    const filter = parseCohortFilter(cohort.filter);
    const tagIds = filter.tagIds ?? [];
    try {
      return await this.cohortRepository.manager.transaction(
        async (manager) => {
          if (tagIds.length) {
            const found = await manager.find(WaitlistTag, {
              select: { id: true },
              where: { id: In(tagIds) },
              lock: { mode: "pessimistic_read" },
            });
            const foundIds = new Set(found.map((row) => row.id));
            const missing = tagIds.filter((id) => !foundIds.has(id));
            if (missing.length) {
              throw new BadRequestException(
                `No waitlist tag with id ${missing.join(", ")}`,
              );
            }
          }
          return { cohort: await manager.save(cohort), filter };
        },
      );
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException("A cohort with that name already exists");
      }
      throw err;
    }
  }

  create(dto: CreateWaitlistCohortDto): Promise<ParsedWaitlistCohort> {
    return this.save(
      this.cohortRepository.create({ name: dto.name, filter: dto.filter }),
    );
  }

  async update(
    id: number,
    dto: UpdateWaitlistCohortDto,
  ): Promise<ParsedWaitlistCohort> {
    const cohort = await this.findOne(id);
    if (dto.name !== undefined) cohort.name = dto.name;
    if (dto.filter !== undefined) cohort.filter = dto.filter;
    return this.save(cohort);
  }

  async delete(id: number): Promise<void> {
    await this.cohortRepository.remove(await this.findOne(id));
  }
}
