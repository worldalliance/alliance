import {
  Body,
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { AdminGuard } from "src/auth/guards/admin.guard";
import {
  AcknowledgeDeadlineShortening,
  ApiAcknowledgeDeadlineShortening,
} from "./acknowledge-deadline-shortening";
import { AdminActionDto } from "./dto/admin-action.dto";
import {
  CreateProjectActionDto,
  RescheduleReleaseDto,
  ScheduleReleaseDto,
} from "./dto/project-action.dto";
import { ProjectActionsService } from "./project-actions.service";

@Controller()
@UseGuards(AdminGuard)
export class ProjectActionsController {
  constructor(private readonly projectActionsService: ProjectActionsService) {}

  @Post("projects/:projectId/actions")
  @ApiOkResponse({ type: AdminActionDto })
  async createAdmin(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Body() body: CreateProjectActionDto,
  ): Promise<AdminActionDto> {
    return new AdminActionDto(
      await this.projectActionsService.create({ projectId, body }),
    );
  }

  @Post("actions/:id/release")
  @ApiOkResponse({ type: AdminActionDto })
  async scheduleReleaseAdmin(
    @Param("id", ParseIntPipe) actionId: number,
    @Body() body: ScheduleReleaseDto,
  ): Promise<AdminActionDto> {
    return new AdminActionDto(
      await this.projectActionsService.scheduleRelease({ actionId, body }),
    );
  }

  @Patch("actions/:id/release")
  @ApiOkResponse({ type: AdminActionDto })
  @ApiAcknowledgeDeadlineShortening()
  async rescheduleReleaseAdmin(
    @Param("id", ParseIntPipe) actionId: number,
    @Body() body: RescheduleReleaseDto,
    @AcknowledgeDeadlineShortening()
    acknowledgeDeadlineShortening: boolean,
  ): Promise<AdminActionDto> {
    return new AdminActionDto(
      await this.projectActionsService.rescheduleRelease({
        actionId,
        body,
        acknowledgeDeadlineShortening,
      }),
    );
  }

  @Delete("actions/:id/release")
  @ApiOkResponse({ type: AdminActionDto })
  async unscheduleReleaseAdmin(
    @Param("id", ParseIntPipe) actionId: number,
  ): Promise<AdminActionDto> {
    return new AdminActionDto(
      await this.projectActionsService.unscheduleRelease(actionId),
    );
  }
}
