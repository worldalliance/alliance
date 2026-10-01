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
import { WaitlistEmailTemplateService } from "./waitlist-email-template.service";

@Controller("waitlist/admin")
@UseGuards(AdminGuard)
export class WaitlistEmailAdminController {
  constructor(private readonly templateService: WaitlistEmailTemplateService) {}

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
