import { type Result } from "@alliance/common/result";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { softDeleteCascade } from "src/datasources/soft-delete";
import { EventType } from "src/eventlog/event-log.entity";
import { EventLogService } from "src/eventlog/eventlog.service";
import { escapeSlackText } from "src/eventlog/slack-format";
import { getImageSource } from "src/images/images.service";
import { deleteClaimedWaitlistTracking } from "src/link-tracking/message-tracking.service";
import { DataSource, type Repository } from "typeorm";
import { User } from "./entities/user.entity";
import { type AccountDeletedPayload, UserEvents } from "./user.events";

@Injectable()
export class AccountDeletionService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly eventLogService: EventLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // The event log is the system of record for deletion requests — the failure
  // is returned to the controller instead of treated as best-effort.
  async requestAccountDeletion(userId: number): Promise<Result<void, Error>> {
    return this.eventLogService.sendMessage({
      type: EventType.AccountDeletionRequested,
      message: `User ${userId} requested account deletion`,
      userId: userId,
      blob: null,
    });
  }

  /**
   * Soft-deletes a member. Everything keyed to them is hidden with the row:
   * forum posts and comments, action activity (so completion counts drop),
   * messages, notifications, and their own event-log history. The rows stay
   * in the database for an operator to restore by hand; join rows such as
   * group memberships, likes, tags and co-authorships are deleted instead. The
   * click history of a waitlist entry whose invite they claimed is hidden too.
   *
   * The deletion also bumps the account's session generation, so every
   * session issued before it stays invalid, even after a restore.
   *
   * The record of the deletion is written with a null `userId`: it is the
   * admin's act, not part of the member's history that the deletion hides and
   * a restore brings back. It shares the deletion's transaction, so a
   * failure to write it takes the deletion with it rather than leave an
   * unrecorded one behind.
   */
  async deleteUserAdmin(params: {
    userId: number;
    adminId: number;
    reason: string;
    confirmationEmail: string;
    screenshotKey?: string | null;
  }): Promise<void> {
    const { userId, adminId, reason, confirmationEmail, screenshotKey } =
      params;

    const [user, admin] = await Promise.all([
      this.userRepository.findOne({ where: { id: userId } }),
      this.userRepository.findOne({ where: { id: adminId } }),
    ]);

    if (!user) {
      throw new NotFoundException("User not found");
    }
    if (!admin) {
      throw new UnauthorizedException();
    }
    if (user.id === admin.id) {
      throw new BadRequestException("You cannot delete your own account");
    }
    if (
      confirmationEmail.trim().toLowerCase() !== user.email.trim().toLowerCase()
    ) {
      throw new BadRequestException(
        "Confirmation does not match the member's email address",
      );
    }

    const deleted = { id: user.id, name: user.name, email: user.email };
    const screenshotUrl = screenshotKey ? getImageSource(screenshotKey) : null;

    const summary = `Admin ${admin.name} deleted the account for ${deleted.name} (${deleted.email}, id ${deleted.id}). Reason: ${reason}`;
    const screenshotLink = screenshotUrl
      ? ` — <${screenshotUrl}|screenshot>`
      : "";

    const forwardAudit = await this.dataSource.transaction(async (manager) => {
      await manager.increment(User, { id: deleted.id }, "sessionGeneration", 1);
      await deleteClaimedWaitlistTracking({ manager, userId: deleted.id });
      await softDeleteCascade(manager, { target: User, ids: [deleted.id] });

      return this.eventLogService.sendMessageInTransaction(manager, {
        type: EventType.AccountDeleted,
        message: screenshotUrl ? `${summary} (${screenshotUrl})` : summary,
        slackMessage: `${escapeSlackText(summary)}${screenshotLink}`,
        userId: null,
        blob: {
          deletedUserId: deleted.id,
          deletedUserName: deleted.name,
          deletedUserEmail: deleted.email,
          adminId: admin.id,
          adminName: admin.name,
          reason,
          screenshotUrl,
        },
      });
    });

    const payload: AccountDeletedPayload = { userId: deleted.id };
    this.eventEmitter.emit(UserEvents.AccountDeleted, payload);
    await forwardAudit();
  }
}
