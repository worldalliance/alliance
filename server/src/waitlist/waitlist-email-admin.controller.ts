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
import type { JwtPayload } from "src/auth/tokens";
import { ReqUser } from "src/auth/user.decorator";
import {
  RetryWaitlistEmailDto,
  SendWaitlistEmailDto,
  TestWaitlistEmailDto,
  WaitlistEmailBatchDetailDto,
  WaitlistEmailBatchDto,
} from "./dto/waitlist-email-batch.dto";
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

  @Post("emails/test")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async sendTestEmailAdmin(
    @ReqUser() user: JwtPayload,
    @Body() dto: TestWaitlistEmailDto,
  ): Promise<void> {
    await this.emailService.sendTest({ dto, staffUserId: user.sub });
  }

  @Post("emails")
  @ApiOkResponse({ type: WaitlistEmailBatchDto })
  async sendEmailAdmin(
    @ReqUser() user: JwtPayload,
    @Body() dto: SendWaitlistEmailDto,
  ): Promise<WaitlistEmailBatchDto> {
    return new WaitlistEmailBatchDto(
      await this.emailService.send({ dto, staffUserId: user.sub }),
    );
  }

  @Get("emails")
  @ApiOkResponse({ type: WaitlistEmailBatchDto, isArray: true })
  async findEmailsAdmin(): Promise<WaitlistEmailBatchDto[]> {
    const summaries = await this.emailService.findSummaries();
    return summaries.map((summary) => new WaitlistEmailBatchDto(summary));
  }

  @Get("emails/:id")
  @ApiOkResponse({ type: WaitlistEmailBatchDetailDto })
  async findEmailAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<WaitlistEmailBatchDetailDto> {
    return new WaitlistEmailBatchDetailDto(
      await this.emailService.findDetail(id),
    );
  }

  @Post("emails/:id/retry")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: WaitlistEmailBatchDto })
  async retryEmailAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: RetryWaitlistEmailDto,
  ): Promise<WaitlistEmailBatchDto> {
    return new WaitlistEmailBatchDto(
      await this.emailService.retry({
        id,
        includeUncertain: dto.includeUncertain,
      }),
    );
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
