import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiNoContentResponse, ApiOkResponse } from "@nestjs/swagger";
import { AdminGuard } from "src/auth/guards/admin.guard";
import type { JwtPayload } from "src/auth/tokens";
import { ReqUser } from "src/auth/user.decorator";
import {
  CreateWaitlistCohortDto,
  UpdateWaitlistCohortDto,
  WaitlistCohortDto,
} from "./dto/waitlist-cohort.dto";
import {
  WaitlistChangeCountDto,
  WaitlistEntryFilterBodyDto,
  WaitlistEntryIdsBodyDto,
  WaitlistEntryIdsDto,
  WaitlistEntryInviteDto,
  WaitlistEntryPageDto,
  WaitlistEntrySearchDto,
} from "./dto/waitlist-entry-admin.dto";
import {
  AdminWaitlistLinkDto,
  CreateWaitlistLinkDto,
  UpdateWaitlistLinkDto,
} from "./dto/waitlist-link.dto";
import { WaitlistMetricsDto } from "./dto/waitlist-metrics.dto";
import {
  AdminWaitlistTagDto,
  SaveWaitlistTagDto,
  WaitlistTagDto,
} from "./dto/waitlist-tag.dto";
import { WaitlistCohortService } from "./waitlist-cohort.service";
import { WaitlistEntryAdminService } from "./waitlist-entry-admin.service";
import { WaitlistInviteService } from "./waitlist-invite.service";
import { WaitlistLinkService } from "./waitlist-link.service";
import { WaitlistMetricsService } from "./waitlist-metrics.service";
import { WaitlistTagService } from "./waitlist-tag.service";

@Controller("waitlist/admin")
@UseGuards(AdminGuard)
export class WaitlistAdminController {
  constructor(
    private readonly linkService: WaitlistLinkService,
    private readonly entryService: WaitlistEntryAdminService,
    private readonly tagService: WaitlistTagService,
    private readonly cohortService: WaitlistCohortService,
    private readonly metricsService: WaitlistMetricsService,
    private readonly inviteService: WaitlistInviteService,
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

  @Post("entries/metrics")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: WaitlistMetricsDto })
  async findEntryMetricsAdmin(
    @Body() dto: WaitlistEntryFilterBodyDto,
  ): Promise<WaitlistMetricsDto> {
    return new WaitlistMetricsDto(await this.metricsService.find(dto.filter));
  }

  @Post("entries/mobilize")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: WaitlistChangeCountDto })
  async mobilizeEntriesAdmin(
    @ReqUser() user: JwtPayload,
    @Body() dto: WaitlistEntryIdsBodyDto,
  ): Promise<WaitlistChangeCountDto> {
    return new WaitlistChangeCountDto(
      await this.entryService.setMobilized({
        entryIds: dto.entryIds,
        mobilized: true,
        staffUserId: user.sub,
      }),
    );
  }

  @Post("entries/unmobilize")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: WaitlistChangeCountDto })
  async unmobilizeEntriesAdmin(
    @ReqUser() user: JwtPayload,
    @Body() dto: WaitlistEntryIdsBodyDto,
  ): Promise<WaitlistChangeCountDto> {
    return new WaitlistChangeCountDto(
      await this.entryService.setMobilized({
        entryIds: dto.entryIds,
        mobilized: false,
        staffUserId: user.sub,
      }),
    );
  }

  @Post("entries/mark-spam")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: WaitlistChangeCountDto })
  async markEntriesSpamAdmin(
    @ReqUser() user: JwtPayload,
    @Body() dto: WaitlistEntryIdsBodyDto,
  ): Promise<WaitlistChangeCountDto> {
    return new WaitlistChangeCountDto(
      await this.entryService.setSpam({
        entryIds: dto.entryIds,
        spam: true,
        staffUserId: user.sub,
      }),
    );
  }

  @Post("entries/mark-not-spam")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: WaitlistChangeCountDto })
  async markEntriesNotSpamAdmin(
    @ReqUser() user: JwtPayload,
    @Body() dto: WaitlistEntryIdsBodyDto,
  ): Promise<WaitlistChangeCountDto> {
    return new WaitlistChangeCountDto(
      await this.entryService.setSpam({
        entryIds: dto.entryIds,
        spam: false,
        staffUserId: user.sub,
      }),
    );
  }

  /** Reuses the entry's unused invite, else issues one. Sends nothing. */
  @Post("entries/:id/invite")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: WaitlistEntryInviteDto })
  async inviteEntryAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<WaitlistEntryInviteDto> {
    return new WaitlistEntryInviteDto(
      await this.inviteService.issueForEntry(id),
    );
  }

  /** Leaves mobilization alone; the next email with a signup link issues a new invite. */
  @Post("entries/revoke-invites")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: WaitlistChangeCountDto })
  async revokeEntryInvitesAdmin(
    @Body() dto: WaitlistEntryIdsBodyDto,
  ): Promise<WaitlistChangeCountDto> {
    return new WaitlistChangeCountDto(
      await this.entryService.revokeInvites(dto.entryIds),
    );
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

  @Get("tags")
  @ApiOkResponse({ type: AdminWaitlistTagDto, isArray: true })
  async findTagsAdmin(): Promise<AdminWaitlistTagDto[]> {
    const tags = await this.tagService.findAll();
    return tags.map((tag) => new AdminWaitlistTagDto(tag));
  }

  @Post("tags")
  @ApiOkResponse({ type: WaitlistTagDto })
  async createTagAdmin(
    @Body() dto: SaveWaitlistTagDto,
  ): Promise<WaitlistTagDto> {
    return new WaitlistTagDto(await this.tagService.create(dto.name));
  }

  @Patch("tags/:id")
  @ApiOkResponse({ type: WaitlistTagDto })
  async renameTagAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: SaveWaitlistTagDto,
  ): Promise<WaitlistTagDto> {
    return new WaitlistTagDto(await this.tagService.rename(id, dto.name));
  }

  @Delete("tags/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async deleteTagAdmin(@Param("id", ParseIntPipe) id: number): Promise<void> {
    await this.tagService.delete(id);
  }

  @Post("tags/:id/add")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: WaitlistChangeCountDto })
  async tagEntriesAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: WaitlistEntryIdsBodyDto,
  ): Promise<WaitlistChangeCountDto> {
    return new WaitlistChangeCountDto(
      await this.tagService.add(id, dto.entryIds),
    );
  }

  @Post("tags/:id/remove")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: WaitlistChangeCountDto })
  async untagEntriesAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: WaitlistEntryIdsBodyDto,
  ): Promise<WaitlistChangeCountDto> {
    return new WaitlistChangeCountDto(
      await this.tagService.remove(id, dto.entryIds),
    );
  }

  @Get("cohorts")
  @ApiOkResponse({ type: WaitlistCohortDto, isArray: true })
  async findCohortsAdmin(): Promise<WaitlistCohortDto[]> {
    const cohorts = await this.cohortService.findAll();
    return cohorts.map((cohort) => new WaitlistCohortDto(cohort));
  }

  @Post("cohorts")
  @ApiOkResponse({ type: WaitlistCohortDto })
  async createCohortAdmin(
    @Body() dto: CreateWaitlistCohortDto,
  ): Promise<WaitlistCohortDto> {
    return new WaitlistCohortDto(await this.cohortService.create(dto));
  }

  @Patch("cohorts/:id")
  @ApiOkResponse({ type: WaitlistCohortDto })
  async updateCohortAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateWaitlistCohortDto,
  ): Promise<WaitlistCohortDto> {
    return new WaitlistCohortDto(await this.cohortService.update(id, dto));
  }

  @Delete("cohorts/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async deleteCohortAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<void> {
    await this.cohortService.delete(id);
  }
}
