import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { milliseconds } from "date-fns";
import { LOCK_KEYS } from "src/notifs/lock-keys";
import { withPgAdvisoryLock } from "src/notifs/lock-utils";
import { DataSource } from "typeorm";
import { ActionParticipantsService } from "./action-participants.service";

const [LOCK_KEY1, LOCK_KEY2] = LOCK_KEYS.reloadUsersJoined;
const RELOAD_INTERVAL_MS = milliseconds({ minutes: 10 });

@Injectable()
export class ReloadUsersJoinedWorker {
  private readonly logger = new Logger(ReloadUsersJoinedWorker.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly participants: ActionParticipantsService,
  ) {}

  // prevents edge cases around users joined computations such as users suspending their contracts where its annoying to reload the users joined in response
  @Cron("*/10 * * * *")
  async reloadAllActionUsersJoined() {
    try {
      const ran = await withPgAdvisoryLock(
        this.dataSource,
        LOCK_KEY1,
        LOCK_KEY2,
        async () => {
          const startedAt = Date.now();
          await this.participants.reloadAllActionUsersJoined();
          const elapsedMs = Date.now() - startedAt;
          if (elapsedMs > RELOAD_INTERVAL_MS) {
            this.logger.warn(
              `usersJoined reload took ${elapsedMs}ms, longer than its interval`,
            );
          }
        },
      );
      if (ran === null) {
        this.logger.log("usersJoined reload skipped bc of lock");
      }
    } catch (error) {
      this.logger.error("usersJoined reload failed", error);
    }
  }
}
