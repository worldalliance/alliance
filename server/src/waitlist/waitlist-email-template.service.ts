import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { softDeleteCascade } from "src/datasources/soft-delete";
import { isUniqueViolation } from "src/utils/db-errors";
import type { Repository } from "src/utils/Repository";
import type { SaveWaitlistEmailTemplateDto } from "./dto/waitlist-email-template.dto";
import { WaitlistEmailTemplate } from "./entities/waitlist-email-template.entity";

@Injectable()
export class WaitlistEmailTemplateService {
  constructor(
    @InjectRepository(WaitlistEmailTemplate)
    private readonly templateRepository: Repository<WaitlistEmailTemplate>,
  ) {}

  findAll(): Promise<WaitlistEmailTemplate[]> {
    return this.templateRepository.find({ order: { name: "ASC" } });
  }

  private async findOne(id: number): Promise<WaitlistEmailTemplate> {
    const template = await this.templateRepository.findOneBy({ id });
    if (!template) {
      throw new NotFoundException("Waitlist email template not found");
    }
    return template;
  }

  private async save(
    template: WaitlistEmailTemplate,
  ): Promise<WaitlistEmailTemplate> {
    try {
      return await this.templateRepository.save(template);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException(
          "An email template with that name already exists",
        );
      }
      throw err;
    }
  }

  create(dto: SaveWaitlistEmailTemplateDto): Promise<WaitlistEmailTemplate> {
    return this.save(this.templateRepository.create(dto));
  }

  async update(
    id: number,
    dto: SaveWaitlistEmailTemplateDto,
  ): Promise<WaitlistEmailTemplate> {
    const template = await this.findOne(id);
    template.name = dto.name;
    template.subject = dto.subject;
    template.body = dto.body;
    return this.save(template);
  }

  async delete(id: number): Promise<void> {
    const template = await this.findOne(id);
    await softDeleteCascade(this.templateRepository.manager, {
      target: WaitlistEmailTemplate,
      ids: [template.id],
    });
  }
}
