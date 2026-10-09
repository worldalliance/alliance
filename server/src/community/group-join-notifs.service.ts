import { thrownMessage, thrownStack } from "@alliance/common/errorMessage";
import { R } from "@alliance/common/result";
import { Injectable, Logger } from "@nestjs/common";
import { MessageSource } from "src/link-tracking/message-tracking.entity";
import { MmsService } from "src/mms/mms.service";
import { NotificationCategory } from "src/notifs/entities/notification.entity";
import {
  communityDestination,
  group,
  member,
  notifMessage,
} from "src/notifs/notification-content";
import {
  type CreateNotifParams,
  NotifsService,
} from "src/notifs/notifs.service";
import { groupUrl, siteBaseUrl } from "src/search/approutes";
import type { User } from "src/user/entities/user.entity";
import { newGroupMemberTextsEnabled } from "src/user/user.utils";
import type { Community } from "./entities/community.entity";

type Recipient = Pick<
  User,
  | "id"
  | "textsForNewGroupMembers"
  | "turnedOffAllNotifs"
  | "phoneNumber"
  | "phoneNumberUnsubscribed"
>;

type GroupJoinNotice = {
  community: Pick<Community, "id" | "name">;
  joiners: Pick<User, "id" | "name" | "anonymous">[];
  /** Members and leaders as of before the join; joiners are dropped from it. */
  audience: Recipient[];
};

export function membersAndLeaders(
  community: Pick<Community, "users" | "leaders">,
): User[] {
  return Array.from(
    new Map(
      [...community.users, ...(community.leaders ?? [])].map((user) => [
        user.id,
        user,
      ]),
    ).values(),
  );
}

@Injectable()
export class GroupJoinNotifsService {
  private readonly logger = new Logger(GroupJoinNotifsService.name);

  constructor(
    private readonly notifsService: NotifsService,
    private readonly mmsService: MmsService,
  ) {}

  /** Never rejects, so a failure here leaves the join it reports standing. */
  async notify({ community, joiners, audience }: GroupJoinNotice) {
    const joinerIds = new Set(joiners.map((joiner) => joiner.id));
    const recipients = Array.from(
      new Map(
        audience
          .filter((recipient) => !joinerIds.has(recipient.id))
          .map((recipient) => [recipient.id, recipient]),
      ).values(),
    );
    const location = groupUrl({ tab: "members", communityId: community.id });
    const sends = joiners.flatMap((joiner) =>
      recipients.map((recipient) => ({
        recipient,
        notif: {
          user: { id: recipient.id },
          category: NotificationCategory.GroupMemberJoined,
          message: notifMessage`${member(joiner)} joined ${group(community)}!`,
          destination: communityDestination(community.id),
          webAppLocation: location,
          associatedUsers: [{ id: joiner.id }],
        } satisfies CreateNotifParams,
      })),
    );
    if (!sends.length) return;

    const saved = await R.fromPromise(
      this.notifsService.sendNotifs(sends.map(({ notif }) => notif)),
    );
    if (!saved.ok) {
      this.logger.error(
        `Failed to save group join notifications for community ${community.id}: ${thrownMessage(saved.error)}`,
        thrownStack(saved.error),
      );
      return;
    }

    const link = `${siteBaseUrl()}${location}`;
    const texts = sends.flatMap(({ recipient }, i) =>
      newGroupMemberTextsEnabled(recipient)
        ? [{ recipient, notification: saved.value[i] }]
        : [],
    );
    const results = await Promise.allSettled(
      texts.map(({ recipient, notification }) =>
        this.mmsService.sendMms({
          to: recipient.phoneNumber!,
          body: `${notification.message} ${link}`,
          mediaUrls: [],
          tracking: {
            owner: { userId: recipient.id },
            source: MessageSource.GroupJoin,
            context: { notificationIds: [notification.id] },
            actionEventNotifId: null,
          },
        }),
      ),
    );
    results.forEach((result, i) => {
      switch (result.status) {
        case "fulfilled":
          break;
        case "rejected":
          this.logger.error(
            `Failed to text group join notification ${texts[i].notification.id}: ${thrownMessage(result.reason)}`,
            thrownStack(result.reason),
          );
          break;
        default:
          result satisfies never;
      }
    });
  }
}
