import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { TimeSpentForUserDto } from './timespent.dto';
import { DailyStatsRecord } from './dailystats.entity';
import { ActionStatsRecord } from './actionstats.entity';
import { AdminGuard } from 'src/auth/guards/admin.guard';
import { MemberCompletionRetentionCohortDto } from './member-completion-retention.dto';
import { AggregateStatsDto } from './aggregatestats.dto';

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

  @UseGuards(AdminGuard)
  @Get('action-stats')
  @ApiOkResponse({ type: [ActionStatsRecord] })
  getActionStats(): Promise<ActionStatsRecord[]> {
    return this.analyticsService.getActionStats();
  }

  @UseGuards(AdminGuard)
  @Post('action-stats/recalculate')
  @ApiOkResponse({ type: [ActionStatsRecord] })
  async recalculateActionStats(): Promise<ActionStatsRecord[]> {
    await this.analyticsService.calculateActionStats();
    return this.analyticsService.getActionStats();
  }

  @UseGuards(AdminGuard)
  @Get('member-completion-retention')
  @ApiOkResponse({ type: [MemberCompletionRetentionCohortDto] })
  getMemberCompletionRetention(): Promise<
    MemberCompletionRetentionCohortDto[]
  > {
    return this.analyticsService.getMemberCompletionRetentionByCohort();
  }

  @UseGuards(AdminGuard)
  @Get('aggregate-stats')
  @ApiOkResponse({ type: AggregateStatsDto })
  async getAggregateStats(): Promise<AggregateStatsDto> {
    return await this.analyticsService.getAggregateStats();
  }
}
