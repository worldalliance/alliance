import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Community } from "src/community/entities/community.entity";
import { assertLive } from "src/datasources/soft-delete";
import { isUniqueViolation } from "src/utils/db-errors";
import { randomToken } from "src/utils/random";
import type { Repository } from "src/utils/Repository";
import { WaitlistEntry } from "src/waitlist/entities/waitlist-entry.entity";
import { WaitlistLink } from "src/waitlist/entities/waitlist-link.entity";
import type { EntityManager } from "typeorm";
import { CreateCampaignDto, UpdateCampaignDto } from "./dto/campaign.dto";
import {
  Campaign,
  CampaignKind,
  HAS_GROUP,
  TAKES_WAITLIST_ENTRIES,
} from "./entities/campaign.entity";

/** Attempts to find a free random `code` before giving up. */
const MAX_CODE_GENERATION_ATTEMPTS = 5;

/** A fixed-length, URL-safe referral code with ~96 bits of entropy. */
function generateCampaignCode(): string {
  return randomToken(12);
}

const GROUP_MISSING = "That group does not exist";

@Injectable()
export class CampaignService {
  constructor(
    @InjectRepository(Campaign)
    private readonly repository: Repository<Campaign>,
  ) {}

  async findAll(): Promise<Campaign[]> {
    return this.repository.find({ order: { createdAt: "DESC" } });
  }

  async findOne(id: number): Promise<Campaign> {
    const campaign = await this.repository.findOne({ where: { id } });
    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }
    return campaign;
  }

  async findByCode(code: string): Promise<Campaign | null> {
    const trimmed = code.trim();
    if (!trimmed) return null;
    return this.repository.findOne({ where: { code: trimmed } });
  }

  async create(dto: CreateCampaignDto): Promise<Campaign> {
    // The generated code collides with an existing one only astronomically
    // rarely; retry a few times on the unique-constraint violation before
    // surfacing an error rather than letting a one-in-a-billion clash 500.
    for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt++) {
      const campaign = this.repository.create({
        name: dto.name,
        code: generateCampaignCode(),
        picture: dto.picture ?? null,
        kind: dto.kind ?? CampaignKind.Campaign,
      });
      try {
        return await this.repository.save(campaign);
      } catch (err) {
        if (isUniqueViolation(err)) continue;
        throw err;
      }
    }
    throw new InternalServerErrorException(
      "Failed to generate a unique campaign code",
    );
  }

  private async hasWaitlistRecords(
    manager: EntityManager,
    organizationId: number,
  ): Promise<boolean> {
    return (
      (await manager.existsBy(WaitlistLink, { organizationId })) ||
      (await manager.existsBy(WaitlistEntry, { organizationId }))
    );
  }

  /**
   * Locks the campaign so a concurrent update can't combine with this one
   * into a state either would have refused.
   */
  async update(id: number, dto: UpdateCampaignDto): Promise<Campaign> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException("No fields to update");
    }
    try {
      return await this.repository.manager.transaction(async (manager) => {
        // Before the campaign: a group's deletion locks the group, then the
        // campaigns pointing at it.
        if (dto.communityId != null) {
          await assertLive(manager, {
            rows: [{ target: Community, id: dto.communityId }],
            gone: () => new BadRequestException(GROUP_MISSING),
          });
        }
        const campaign = await manager.findOne(Campaign, {
          where: { id },
          lock: { mode: "pessimistic_write" },
        });
        if (!campaign) {
          throw new NotFoundException("Campaign not found");
        }
        if (
          dto.kind !== undefined &&
          TAKES_WAITLIST_ENTRIES[campaign.kind] &&
          !TAKES_WAITLIST_ENTRIES[dto.kind] &&
          (await this.hasWaitlistRecords(manager, id))
        ) {
          throw new ConflictException(
            "An organization with waitlist links or entries stays an organization",
          );
        }
        if (dto.name !== undefined) campaign.name = dto.name;
        if (dto.picture !== undefined) campaign.picture = dto.picture;
        if (dto.kind !== undefined) campaign.kind = dto.kind;
        if (dto.communityId !== undefined) {
          campaign.communityId = dto.communityId;
        }
        if (campaign.communityId !== null && !HAS_GROUP[campaign.kind]) {
          throw new BadRequestException(
            "Only an organization can have a group",
          );
        }
        return manager.save(campaign);
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException(
          "That group already belongs to another organization",
        );
      }
      throw err;
    }
  }
}
