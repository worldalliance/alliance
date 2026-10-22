import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { ActionEventReminderService } from "src/notifs/action-event-reminder.service";
import { PreviewNotificationPlanDto } from "src/notifs/dto/notification-plan.dto";
import { ActionEventNotifDto } from "src/notifs/entities/action-event-notif.dto";
import { MissedSuitePlanService } from "src/notifs/missed-suite-plans.service";
import { ReminderGroupService } from "src/notifs/reminder-group.service";
import { ReminderPreviewService } from "src/notifs/reminder-preview.service";
import { AdminGuard } from "../auth/guards/admin.guard";
import { ActionsService } from "./actions.service";
import {
  CreateReminderGroupDto,
  PreviewEmailHtmlDto,
  PreviewEmailHtmlResponseDto,
  PreviewTextDto,
  PreviewTextMessageResponseDto,
  ReminderAnchorCandidateDto,
  ReminderGroupDto,
} from "./dto/action.dto";
import {
  NotificationScheduleEntryDto,
  NotificationScheduleQueryDto,
} from "./dto/notification-schedule.dto";

@Controller("actions")
export class ActionRemindersController {
  constructor(
    private readonly actionsService: ActionsService,
    private readonly actionEventReminderService: ActionEventReminderService,
    private readonly missedSuitePlanService: MissedSuitePlanService,
    private readonly reminderGroupService: ReminderGroupService,
    private readonly reminderPreviewService: ReminderPreviewService,
  ) {}

  @Get("notification-schedule")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: NotificationScheduleEntryDto, isArray: true })
  async getNotificationScheduleAdmin(
    @Query() query: NotificationScheduleQueryDto,
  ): Promise<NotificationScheduleEntryDto[]> {
    const start = new Date(query.windowStart);
    const end = new Date(query.windowEnd);

    const schedule =
      await this.actionEventReminderService.getNotificationSchedule(start, end);

    return schedule.map((entry) => new NotificationScheduleEntryDto(entry));
  }

  @Patch("remindergroups/:groupId")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ReminderGroupDto })
  async updateReminderGroupAdmin(
    @Param("groupId", ParseIntPipe) groupId: number,
    @Body() body: CreateReminderGroupDto,
  ): Promise<ReminderGroupDto> {
    return new ReminderGroupDto(
      await this.reminderGroupService.updateReminderGroup(groupId, body),
    );
  }

  @Post("events/:eventId/createremindergroup")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ReminderGroupDto })
  async createReminderGroupAdmin(
    @Param("eventId", ParseIntPipe) eventId: number,
    @Body() body: CreateReminderGroupDto,
  ): Promise<ReminderGroupDto> {
    return new ReminderGroupDto(
      await this.reminderGroupService.createReminderGroup(eventId, body),
    );
  }

  @Delete("reminders/:groupId")
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async deleteReminderGroupAdmin(
    @Param("groupId", ParseIntPipe) groupId: number,
  ): Promise<void> {
    await this.reminderGroupService.deleteReminderGroup(groupId);
  }

  @Get("plansForGroup/:groupId")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: PreviewNotificationPlanDto, isArray: true })
  async plansForGroupAdmin(
    @Param("groupId", ParseIntPipe) groupId: number,
  ): Promise<PreviewNotificationPlanDto[]> {
    return this.missedSuitePlanService.toPreview(
      await this.actionEventReminderService.findNotificationPlansForGroup(
        groupId,
      ),
    );
  }

  @Get("sentNotifsForGroup/:groupId")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionEventNotifDto, isArray: true })
  async sentNotifsForGroupAdmin(
    @Param("groupId", ParseIntPipe) groupId: number,
  ): Promise<ActionEventNotifDto[]> {
    return this.actionEventReminderService.getSentNotifsForGroup(groupId);
  }

  @Get("reminderGroupsForEvent/:id")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ReminderGroupDto, isArray: true })
  async reminderGroupsForEventAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ReminderGroupDto[]> {
    const groups =
      await this.reminderGroupService.getReminderGroupsForEvent(id);
    return groups.map((group) => new ReminderGroupDto(group));
  }

  @Get("reminderAnchorCandidates/:eventId")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ReminderAnchorCandidateDto, isArray: true })
  async reminderAnchorCandidatesAdmin(
    @Param("eventId", ParseIntPipe) eventId: number,
  ): Promise<ReminderAnchorCandidateDto[]> {
    const candidates =
      await this.reminderGroupService.findReminderAnchorCandidates(eventId);
    return candidates.map(
      (candidate) => new ReminderAnchorCandidateDto(candidate),
    );
  }

  @Post("events/:eventId/checkTentativePlans")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: PreviewNotificationPlanDto, isArray: true })
  async tentativePlansForGroupAdmin(
    @Param("eventId", ParseIntPipe) eventId: number,
    @Body() body: CreateReminderGroupDto,
  ): Promise<PreviewNotificationPlanDto[]> {
    return this.missedSuitePlanService.toPreview(
      await this.actionsService.tentativePlansForGroup(eventId, body),
    );
  }

  @Post("previewEmailHtml/:eventId")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: PreviewEmailHtmlResponseDto })
  async previewEmailHtmlAdmin(
    @Param("eventId", ParseIntPipe) eventId: number,
    @Body() body: PreviewEmailHtmlDto,
  ): Promise<PreviewEmailHtmlResponseDto> {
    return new PreviewEmailHtmlResponseDto(
      await this.reminderPreviewService.previewEmailHtml(eventId, body),
    );
  }

  @Post("previewTextMessage/:eventId")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: PreviewTextMessageResponseDto })
  async previewTextMessageAdmin(
    @Param("eventId", ParseIntPipe) eventId: number,
    @Body() body: PreviewTextDto,
  ): Promise<PreviewTextMessageResponseDto> {
    return new PreviewTextMessageResponseDto(
      await this.reminderPreviewService.previewTextMessage(eventId, body),
    );
  }
}
