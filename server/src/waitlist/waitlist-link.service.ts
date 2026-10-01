import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  Campaign,
  TAKES_WAITLIST_ENTRIES,
} from "src/campaign/entities/campaign.entity";
import { randomToken } from "src/utils/random";
import type { Repository } from "src/utils/Repository";
import type {
  AdminWaitlistLink,
  CreateWaitlistLinkDto,
  UpdateWaitlistLinkDto,
} from "./dto/waitlist-link.dto";
import { WaitlistEntry } from "./entities/waitlist-entry.entity";
import { WaitlistLink } from "./entities/waitlist-link.entity";

@Injectable()
export class WaitlistLinkService {
  constructor(
    @InjectRepository(WaitlistLink)
    private readonly linkRepository: Repository<WaitlistLink>,
    @InjectRepository(WaitlistEntry)
    private readonly entryRepository: Repository<WaitlistEntry>,
  ) {}

  async findAll(): Promise<AdminWaitlistLink[]> {
    const links = await this.linkRepository.find({
      order: { createdAt: "DESC" },
    });
    const counts = await this.entryRepository
      .createQueryBuilder("entry")
      .select('entry."sourceLinkId"', "linkId")
      .addSelect("COUNT(*)", "count")
      .where('entry."sourceLinkId" IS NOT NULL')
      .groupBy('entry."sourceLinkId"')
      .getRawMany<{ linkId: number; count: string }>();

    const countByLink = new Map(
      counts.map((row) => [row.linkId, Number(row.count)]),
    );
    return links.map((link) => ({
      link,
      entryCount: countByLink.get(link.id) ?? 0,
    }));
  }

  /**
   * Share-locks the organization so `CampaignService.update` can't turn it
   * into a campaign while the link is created.
   */
  create(dto: CreateWaitlistLinkDto): Promise<AdminWaitlistLink> {
    return this.linkRepository.manager.transaction(async (manager) => {
      const organization = await manager.findOne(Campaign, {
        where: { id: dto.organizationId },
        lock: { mode: "pessimistic_read" },
      });
      if (!organization || !TAKES_WAITLIST_ENTRIES[organization.kind]) {
        throw new BadRequestException("Links belong to an organization");
      }
      const link = await manager.save(
        manager.create(WaitlistLink, {
          code: randomToken(8),
          organizationId: organization.id,
          channel: dto.channel,
          publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
        }),
      );
      return { link, entryCount: 0 };
    });
  }

  async update(
    id: number,
    dto: UpdateWaitlistLinkDto,
  ): Promise<AdminWaitlistLink> {
    const link = await this.linkRepository.findOneBy({ id });
    if (!link) {
      throw new NotFoundException("Waitlist link not found");
    }
    if (dto.channel !== undefined) link.channel = dto.channel;
    if (dto.publishedAt !== undefined) {
      link.publishedAt = dto.publishedAt ? new Date(dto.publishedAt) : null;
    }
    if (dto.archived !== undefined) {
      link.archivedAt = dto.archived ? (link.archivedAt ?? new Date()) : null;
    }
    const [saved, entryCount] = await Promise.all([
      this.linkRepository.save(link),
      this.entryRepository.countBy({ sourceLinkId: id }),
    ]);
    return { link: saved, entryCount };
  }
}
