import type { Result } from "@alliance/common/result";
import { Injectable } from "@nestjs/common";
import { EventType } from "src/eventlog/event-log.entity";
import { EventLogService } from "src/eventlog/eventlog.service";
import { escapeSlackText } from "src/eventlog/slack-format";
import { CreateJoinRequestDto } from "./dto/join-request.dto";

/**
 * Lays the three answers out one per line so the reason, which is the only
 * long field, is the last thing read. Slack renders `>` as a quote block, so
 * a multi-line reason stays visually separate from the contact details.
 */
export function formatSlackMessage(dto: CreateJoinRequestDto): string {
  const quoted = dto.reason
    .trim()
    .split("\n")
    .map((line) => `> ${escapeSlackText(line)}`)
    .join("\n");

  return [
    "*New request to join*",
    `*Name:* ${escapeSlackText(dto.name)}`,
    `*Email:* ${escapeSlackText(dto.email)}`,
    "*Why they want to join:*",
    quoted,
  ].join("\n");
}

@Injectable()
export class JoinRequestsService {
  constructor(private readonly eventLogService: EventLogService) {}

  async create(dto: CreateJoinRequestDto): Promise<Result<void, Error>> {
    return this.eventLogService.sendMessage({
      type: EventType.JoinRequest,
      message: `Join request from ${dto.name} (${dto.email}): ${dto.reason}`,
      slackMessage: formatSlackMessage(dto),
      blob: { name: dto.name, email: dto.email, reason: dto.reason },
      userId: null,
    });
  }
}
