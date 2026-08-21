import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ActionsModule } from "src/actions/actions.module";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import { Action } from "src/actions/entities/action.entity";
import { ReminderGroup } from "src/actions/entities/reminder-group.entity";
import { ActionEventNotif } from "src/notifs/entities/action-event-notif.entity";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import { ContractEvent } from "src/user/entities/contract-event.entity";
import { OnetimeInvite } from "src/user/entities/onetime-invite.entity";
import { User } from "src/user/entities/user.entity";
import { UserModule } from "src/user/user.module";
import { ActionStatsRecord } from "./actionstats.entity";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";
import { DailyStatsRecord } from "./dailystats.entity";

@Module({
  imports: [
    UserModule,
    ActionsModule,
    TypeOrmModule.forFeature([
      DailyStatsRecord,
      ActionStatsRecord,
      User,
      ActionActivity,
      OnetimeInvite,
      FormResponse,
      Action,
      ContractEvent,
      ReminderGroup,
      ActionEventNotif,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
