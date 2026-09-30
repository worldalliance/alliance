import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { AdminGuard } from "src/auth/guards/admin.guard";
import {
  AdminWaitlistLinkDto,
  CreateWaitlistLinkDto,
  UpdateWaitlistLinkDto,
} from "./dto/waitlist-link.dto";
import { WaitlistLinkService } from "./waitlist-link.service";

@Controller("waitlist/admin")
@UseGuards(AdminGuard)
export class WaitlistAdminController {
  constructor(private readonly linkService: WaitlistLinkService) {}

  @Get("links")
  @ApiOkResponse({ type: AdminWaitlistLinkDto, isArray: true })
  async findLinksAdmin(): Promise<AdminWaitlistLinkDto[]> {
    const links = await this.linkService.findAll();
    return links.map((link) => new AdminWaitlistLinkDto(link));
  }

  @Post("links")
  @ApiOkResponse({ type: AdminWaitlistLinkDto })
  async createLinkAdmin(
    @Body() dto: CreateWaitlistLinkDto,
  ): Promise<AdminWaitlistLinkDto> {
    return new AdminWaitlistLinkDto(await this.linkService.create(dto));
  }

  @Patch("links/:id")
  @ApiOkResponse({ type: AdminWaitlistLinkDto })
  async updateLinkAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateWaitlistLinkDto,
  ): Promise<AdminWaitlistLinkDto> {
    return new AdminWaitlistLinkDto(await this.linkService.update(id, dto));
  }
}
