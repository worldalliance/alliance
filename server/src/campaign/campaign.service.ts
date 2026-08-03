import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomToken } from 'src/utils/random';
import { QueryFailedError } from 'typeorm';
import type { Repository } from 'src/utils/Repository';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';
import { Campaign } from './entities/campaign.entity';

/** Attempts to find a free random `code` before giving up. */
const MAX_CODE_GENERATION_ATTEMPTS = 5;

/** A fixed-length, URL-safe referral code with ~96 bits of entropy. */
function generateCampaignCode(): string {
  return randomToken(12);
}

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof QueryFailedError &&
    (err as { code?: string }).code === '23505'
  );
}

@Injectable()
export class CampaignService {
  constructor(
    @InjectRepository(Campaign)
    private readonly repository: Repository<Campaign>,
  ) {}

  async findAll(): Promise<Campaign[]> {
    return this.repository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: number): Promise<Campaign> {
    const campaign = await this.repository.findOne({ where: { id } });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
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
      });
      try {
        return await this.repository.save(campaign);
      } catch (err) {
        if (isUniqueViolation(err)) continue;
        throw err;
      }
    }
    throw new InternalServerErrorException(
      'Failed to generate a unique campaign code',
    );
  }

  async update(id: number, dto: UpdateCampaignDto): Promise<Campaign> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('No fields to update');
    }
    const campaign = await this.findOne(id);
    if (dto.name !== undefined) campaign.name = dto.name;
    if (dto.picture !== undefined) campaign.picture = dto.picture;
    return this.repository.save(campaign);
  }
}
