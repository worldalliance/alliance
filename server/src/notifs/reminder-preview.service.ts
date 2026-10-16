import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  PreviewEmailHtmlDto,
  PreviewEmailHtmlResponse,
  PreviewTextDto,
  ReminderPreviewContextDto,
} from "src/actions/dto/action.dto";
import { EmailType } from "src/mail/mail.entity";
import { MailService, processKeywordReplacements } from "src/mail/mail.service";
import { type Repository } from "typeorm";
import {
  ActionEvent,
  loadedActionEventAction,
} from "../actions/entities/action-event.entity";
import { memberActionPhase } from "../actions/utils/action-event";
import { testUser } from "./test-users";

@Injectable()
export class ReminderPreviewService {
  constructor(
    @InjectRepository(ActionEvent)
    private readonly eventRepository: Repository<ActionEvent>,
    private readonly mailService: MailService,
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
}
