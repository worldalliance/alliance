import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ActionParticipantsService } from "./action-participants.service";

@Injectable()
export class ReloadUsersJoinedWorker {
  constructor(private readonly participants: ActionParticipantsService) {}

  // prevents edge cases around users joined computations such as users suspending their contracts where its annoying to reload the users joined in response
  @Cron("*/10 * * * *")
  async reloadAllActionUsersJoined() {
    this.participants.reloadAllActionUsersJoined();
  }
}
