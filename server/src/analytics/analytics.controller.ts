import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { TimeSpentForUserDto } from './timespent.dto';
import { DailyStatsRecord } from './dailystats.entity';
import { AdminGuard } from 'src/auth/guards/admin.guard';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('time-spent-per-user')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [TimeSpentForUserDto] })
  getTimeSpentPerUser() {
    return this.analyticsService.getTimeSpentPerUser();
  }

  @Get('time-spent-per-user-total')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [TimeSpentForUserDto] })
  getTimeSpentPerUserTotal() {
    return this.analyticsService.getTimeSpentPerUserTotal();
  }

  @UseGuards(AdminGuard)
  @Get('daily-stats')
  @ApiOkResponse({ type: [DailyStatsRecord] })
  getDailyStats(
    @Query('date') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.analyticsService.getDailyStats(startDate, endDate);
  }
}
