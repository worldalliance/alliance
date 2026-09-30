import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ApiNoContentResponse, ApiOkResponse } from "@nestjs/swagger";
import { AdminGuard } from "src/auth/guards/admin.guard";
import {
  SaveWaitlistEmailTemplateDto,
  WaitlistEmailTemplateDto,
} from "./dto/waitlist-email-template.dto";
import {
  PreviewWaitlistEmailDto,
  WaitlistEmailPreviewDto,
} from "./dto/waitlist-email.dto";
import { WaitlistEmailTemplateService } from "./waitlist-email-template.service";
import { WaitlistEmailService } from "./waitlist-email.service";

@Controller("waitlist/admin")
@UseGuards(AdminGuard)
export class WaitlistEmailAdminController {
  constructor(
    private readonly templateService: WaitlistEmailTemplateService,
    private readonly emailService: WaitlistEmailService,
  ) {}

  /** Who a send would reach and skip, and one recipient's rendered email. */
  @Post("emails/preview")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: WaitlistEmailPreviewDto })
  async previewEmailAdmin(
    @Body() dto: PreviewWaitlistEmailDto,
  ): Promise<WaitlistEmailPreviewDto> {
    return new WaitlistEmailPreviewDto(await this.emailService.preview(dto));
  }

  @Get("email-templates")
  @ApiOkResponse({ type: WaitlistEmailTemplateDto, isArray: true })
  async findTemplatesAdmin(): Promise<WaitlistEmailTemplateDto[]> {
    const templates = await this.templateService.findAll();
    return templates.map((template) => new WaitlistEmailTemplateDto(template));
  }

  @Post("email-templates")
  @ApiOkResponse({ type: WaitlistEmailTemplateDto })
  async createTemplateAdmin(
    @Body() dto: SaveWaitlistEmailTemplateDto,
  ): Promise<WaitlistEmailTemplateDto> {
    return new WaitlistEmailTemplateDto(await this.templateService.create(dto));
  }

  @Put("email-templates/:id")
  @ApiOkResponse({ type: WaitlistEmailTemplateDto })
  async updateTemplateAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: SaveWaitlistEmailTemplateDto,
  ): Promise<WaitlistEmailTemplateDto> {
    return new WaitlistEmailTemplateDto(
      await this.templateService.update(id, dto),
    );
  }

  @Delete("email-templates/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async deleteTemplateAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<void> {
    await this.templateService.delete(id);
  }
}
