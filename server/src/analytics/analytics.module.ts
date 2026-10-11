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
import { ActionStatsAnalyticsService } from "./action-stats-analytics.service";
import { ActionStatsRecord } from "./actionstats.entity";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";
import { ContractAnalyticsService } from "./contract-analytics.service";
import { DailyStatsRecord } from "./dailystats.entity";
import { MemberRetentionAnalyticsService } from "./member-retention-analytics.service";
import { PlatformTenureAnalyticsService } from "./platform-tenure-analytics.service";
import { PosthogTimeSpentService } from "./posthog-time-spent.service";

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
  providers: [
    AnalyticsService,
    PosthogTimeSpentService,
    ActionStatsAnalyticsService,
    PlatformTenureAnalyticsService,
    ContractAnalyticsService,
    MemberRetentionAnalyticsService,
  ],
})
export class AnalyticsModule {}
