import { memberActionPhase } from "@alliance/common/actionEvent";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { milliseconds } from "date-fns";
import {
  CreateReminderGroupDto,
  PreviewEmailHtmlDto,
  PreviewEmailHtmlResponse,
  PreviewTextDto,
  ReminderPreviewContextDto,
} from "src/actions/dto/reminder-group.dto";
import { ActionSuite } from "src/actions/entities/action-suite.entity";
import { ReminderGroup } from "src/actions/entities/reminder-group.entity";
import { EmailType } from "src/mail/mail.entity";
import { MailService, processKeywordReplacements } from "src/mail/mail.service";
import { type Repository } from "typeorm";
import {
  ActionEvent,
  loadedActionEventAction,
} from "../actions/entities/action-event.entity";
import {
  ActionEventReminderService,
  NOTIFICATION_LOOKBACK_WINDOW_MS,
} from "./action-event-reminder.service";
import { NotificationPlan } from "./dto/notification-plan.dto";
import { ReminderGroupService } from "./reminder-group.service";
import { testUser } from "./test-users";

@Injectable()
export class ReminderPreviewService {
  constructor(
    @InjectRepository(ActionEvent)
    private readonly eventRepository: Repository<ActionEvent>,
    @InjectRepository(ActionSuite)
    private readonly actionSuiteRepository: Repository<ActionSuite>,
    private readonly mailService: MailService,
    private readonly reminderGroupService: ReminderGroupService,
    private readonly actionEventReminderService: ActionEventReminderService,
  ) {}

  private async loadEventsForPreview(
    eventId: number,
  ): Promise<{ deadlineEvent: ActionEvent | undefined; event: ActionEvent }> {
    const event = await this.eventRepository.findOneOrFail({
      where: { id: eventId },
      relations: { action: true },
    });
    const events = await this.eventRepository.find({
      where: { action: { id: loadedActionEventAction(event).id } },
    });
    return {
      event,
      deadlineEvent: memberActionPhase(events).deadlineEvent ?? undefined,
    };
  }

  private async getKeywordContextForPreview(
    eventId: number,
    dto: ReminderPreviewContextDto,
    sendTime?: Date,
  ) {
    const { event, deadlineEvent } = await this.loadEventsForPreview(eventId);

    return {
      action: loadedActionEventAction(event),
      deadlineEvent,
      user: testUser,
      uncompletedTasksCount: dto.taskCount,
      uncompletedTasksTime: dto.taskCount * 5 + " minutes",
      uncompletedTasksNames: ["Task 1", "Task 2", "Task 3"].slice(
        0,
        dto.taskCount,
      ),
      dateNow: sendTime,
      uncompletedMembersInGroupCount: dto.uncompletedMembersInGroupCount,
    };
  }

  async previewEmailHtml(
    eventId: number,
    dto: PreviewEmailHtmlDto,
    sendTime?: Date,
  ): Promise<PreviewEmailHtmlResponse> {
    const context = await this.getKeywordContextForPreview(
      eventId,
      dto,
      sendTime,
    );

    const replacedMessage = processKeywordReplacements(
      dto.emailMessage,
      context,
    );
    const replacedSubject = processKeywordReplacements(
      dto.emailSubject,
      context,
    );

    const html = await this.mailService.renderHtml(
      EmailType.CustomActionReminder,
      {
        customMessage: replacedMessage.replace(/\n/g, "<br>"),
      },
    );

    return {
      subject: replacedSubject,
      html,
    };
  }

  async previewTextMessage(
    eventId: number,
    dto: PreviewTextDto,
    sendTime?: Date,
  ): Promise<string> {
    const context = await this.getKeywordContextForPreview(
      eventId,
      dto,
      sendTime,
    );

    return processKeywordReplacements(dto.textMessage, context);
  }

  async tentativePlansForGroup(
    eventId: number,
    body: CreateReminderGroupDto,
  ): Promise<NotificationPlan[]> {
    const event = await this.eventRepository.findOneOrFail({
      where: { id: eventId },
      relations: {
        action: {
          events: true,
        },
      },
    });
    const fields = await this.reminderGroupService.reminderGroupFieldsFromDto(
      body,
      event,
    );

    let actionSuite: ActionSuite | undefined = undefined;
    if (body.suiteId) {
      actionSuite = await this.actionSuiteRepository.findOneOrFail({
        where: { id: body.suiteId },
        relations: { actions: true },
      });
    }

    const withDeadlineEvent =
      await this.reminderGroupService.attachSendableDeadlineEvent({
        ...fields,
        id: 0,
        name: "Tentative Reminder Group",
        memberActionEvent: event,
        notifications: [],
        allSent: false,
        actionSuite,
        deletedAt: null,
      } satisfies ReminderGroup);

    return this.actionEventReminderService.findPlansForGroup(
      withDeadlineEvent,
      new Date(Date.now() - NOTIFICATION_LOOKBACK_WINDOW_MS),
      new Date(Date.now() + milliseconds({ days: 30 })),
    );
  }
}
