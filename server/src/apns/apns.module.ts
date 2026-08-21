import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ActionsModule } from "src/actions/actions.module";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import { Action } from "src/actions/entities/action.entity";
import { UserDevice } from "src/user/entities/user-device.entity";
import { ApnsService } from "./apns.service";
import { LiveActivityRegistration } from "./entities/live-activity-registration.entity";
import { LiveActivityService } from "./live-activity.service";
import { LiveActivityWorker } from "./live-activity.worker";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LiveActivityRegistration,
      Action,
      ActionActivity,
      UserDevice,
    ]),
    forwardRef(() => ActionsModule),
  ],
  providers: [ApnsService, LiveActivityService, LiveActivityWorker],
  exports: [ApnsService, LiveActivityService],
})
export class ApnsModule {}
