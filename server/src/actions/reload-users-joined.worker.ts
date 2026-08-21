import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ActionsService } from "./actions.service";

@Injectable()
export class ReloadUsersJoinedWorker {
  constructor(private readonly actionsService: ActionsService) {}

  // prevents edge cases around users joined computations such as users suspending their contracts where its annoying to reload the users joined in response
  @Cron("*/10 * * * *")
  async reloadAllActionUsersJoined() {
    this.actionsService.reloadAllActionUsersJoined();
  }
}
