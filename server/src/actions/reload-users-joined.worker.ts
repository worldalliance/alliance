import { Injectable, Logger } from "@nestjs/common";
import { WithoutOverlapping } from "@nestjs/locks";
import { Cron } from "@nestjs/schedule";
import { milliseconds } from "date-fns";
import { CronLease } from "src/leases/cron-lease";
import { ActionParticipantsService } from "./action-participants.service";

const RELOAD_INTERVAL_MS = milliseconds({ minutes: 10 });

@Injectable()
export class ReloadUsersJoinedWorker {
  private readonly logger = new Logger(ReloadUsersJoinedWorker.name);

  constructor(private readonly participants: ActionParticipantsService) {}

  // prevents edge cases around users joined computations such as users suspending their contracts where its annoying to reload the users joined in response
  @Cron("*/10 * * * *")
  @WithoutOverlapping({ key: CronLease.ReloadUsersJoined })
  async reloadAllActionUsersJoined() {
    try {
      const startedAt = Date.now();
      await this.participants.reloadAllActionUsersJoined();
      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs > RELOAD_INTERVAL_MS) {
        this.logger.warn(
          `usersJoined reload took ${elapsedMs}ms, longer than its interval`,
        );
      }
    } catch (error) {
      this.logger.error("usersJoined reload failed", error);
    }
  }
}
