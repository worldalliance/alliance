import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { AdminGuard } from "src/auth/guards/admin.guard";
import {
  WaitlistEntryFilterBodyDto,
  WaitlistEntryIdsDto,
  WaitlistEntryPageDto,
  WaitlistEntrySearchDto,
} from "./dto/waitlist-entry-admin.dto";
import {
  AdminWaitlistLinkDto,
  CreateWaitlistLinkDto,
  UpdateWaitlistLinkDto,
} from "./dto/waitlist-link.dto";
import { WaitlistEntryAdminService } from "./waitlist-entry-admin.service";
import { WaitlistLinkService } from "./waitlist-link.service";

@Controller("waitlist/admin")
@UseGuards(AdminGuard)
export class WaitlistAdminController {
  constructor(
    private readonly linkService: WaitlistLinkService,
    private readonly entryService: WaitlistEntryAdminService,
  ) {}

  @Post("entries/search")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: WaitlistEntryPageDto })
  async searchEntriesAdmin(
    @Body() dto: WaitlistEntrySearchDto,
  ): Promise<WaitlistEntryPageDto> {
    return new WaitlistEntryPageDto(await this.entryService.search(dto));
  }

  /** Every matching entry, for acting on a selection across pages. */
  @Post("entries/ids")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: WaitlistEntryIdsDto })
  async findEntryIdsAdmin(
    @Body() dto: WaitlistEntryFilterBodyDto,
  ): Promise<WaitlistEntryIdsDto> {
    return new WaitlistEntryIdsDto(await this.entryService.findIds(dto.filter));
  }

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
