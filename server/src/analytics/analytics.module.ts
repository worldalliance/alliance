import { Module } from '@nestjs/common';
import { UserModule } from 'src/user/user.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { DailyStatsRecord } from './dailystats.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/user/entities/user.entity';
import { ActionActivity } from 'src/actions/entities/action-activity.entity';
import { OnetimeInvite } from 'src/user/entities/onetime-invite.entity';

@Module({
  imports: [
    UserModule,
    TypeOrmModule.forFeature([
      DailyStatsRecord,
      User,
      ActionActivity,
      OnetimeInvite,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
