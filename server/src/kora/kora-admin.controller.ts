import {
  KORA_ACTIVE_NEEDS_TRANSCRIPTS,
  KORA_NOTIFY_NEEDS_ACTIVE,
} from "@alliance/common/kora";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ApiNoContentResponse, ApiOkResponse } from "@nestjs/swagger";
import { AdminGuard } from "src/auth/guards/admin.guard";
import { KoraAdminOverviewDto } from "./dto/kora-admin.dto";
import {
  KoraAdminProjectDto,
  KoraNotifyQueuedDto,
  UpdateKoraProjectDto,
} from "./dto/kora-project.dto";
import { KoraAdminService } from "./kora-admin.service";
import {
  KoraNotice,
  KoraNotifyError,
  KoraNotifyService,
} from "./kora-notify.service";
import {
  KoraProjectError,
  KoraProjectService,
  type KoraProjectState,
} from "./kora-project.service";

@Controller("kora/admin")
@UseGuards(AdminGuard)
export class KoraAdminController {
  constructor(
    private readonly adminService: KoraAdminService,
    private readonly projectService: KoraProjectService,
    private readonly notifyService: KoraNotifyService,
  ) {}

  private async projectDto(
    state: KoraProjectState,
  ): Promise<KoraAdminProjectDto> {
    const [toNotify, moreToNotify] = await Promise.all([
      this.notifyService.toNotify(KoraNotice.Launch),
      this.notifyService.toNotify(KoraNotice.More),
    ]);
    return new KoraAdminProjectDto({ ...state, toNotify, moreToNotify });
  }

  @Get("project")
  @ApiOkResponse({ type: KoraAdminProjectDto })
  async project(): Promise<KoraAdminProjectDto> {
    return this.projectDto(await this.projectService.adminProject());
  }

  @Put("project")
  @ApiOkResponse({ type: KoraAdminProjectDto })
  async updateProject(
    @Body() body: UpdateKoraProjectDto,
  ): Promise<KoraAdminProjectDto> {
    const updated = await this.projectService.setStatus(body.status);
    if (!updated.ok) {
      switch (updated.error) {
        case KoraProjectError.NeedsTranscripts:
          throw new BadRequestException(KORA_ACTIVE_NEEDS_TRANSCRIPTS);
        default:
          throw new Error(`unknown error: ${updated.error satisfies never}`);
      }
    }
    return this.projectDto(updated.value);
  }

  @Post("notify-waitlist")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: KoraNotifyQueuedDto })
  async notifyWaitlist(): Promise<KoraNotifyQueuedDto> {
    return this.startNotice(KoraNotice.Launch);
  }

  @Post("notify-more")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: KoraNotifyQueuedDto })
  async notifyMore(): Promise<KoraNotifyQueuedDto> {
    return this.startNotice(KoraNotice.More);
  }

  private async startNotice(notice: KoraNotice): Promise<KoraNotifyQueuedDto> {
    const started = await this.notifyService.notify(notice);
    if (!started.ok) {
      switch (started.error) {
        case KoraNotifyError.NotActive:
          throw new BadRequestException(KORA_NOTIFY_NEEDS_ACTIVE);
        default:
          throw new Error(`unknown error: ${started.error satisfies never}`);
      }
    }
    return new KoraNotifyQueuedDto(started.value);
  }

  @Get("participants")
  @ApiOkResponse({ type: KoraAdminOverviewDto })
  async overview(): Promise<KoraAdminOverviewDto> {
    return new KoraAdminOverviewDto(await this.adminService.overview());
  }

  @Delete("participants/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async deleteParticipant(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    const deleted = await this.adminService.deleteParticipant(id);
    if (!deleted.ok) {
      throw new NotFoundException("Participant not found");
    }
  }

  @Delete("abandoned-signups/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async deleteAbandonedSignup(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    const deleted = await this.adminService.deleteAbandonedSignup(id);
    if (!deleted.ok) {
      throw new NotFoundException("Abandoned signup not found");
    }
  }
}
