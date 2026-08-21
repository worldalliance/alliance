import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse, ApiQuery } from "@nestjs/swagger";
import { AdminGuard } from "src/auth/guards/admin.guard";
import { ActionCompletionCurveDto } from "./action-completion-curve.dto";
import { ActionStatsWithOnboardingDto } from "./actionstats-with-onboarding.dto";
import { AggregateStatsDto } from "./aggregatestats.dto";
import { AnalyticsService } from "./analytics.service";
import { ContractStatusPointDto } from "./contract-status-history.dto";
import { DailyStatsDto } from "./dailystats.dto";
import { InviteFunnelDto } from "./invite-funnel.dto";
import { MemberCompletionRetentionCohortDto } from "./member-completion-retention.dto";
import { MemberReliabilityWindowDto } from "./member-reliability-window.dto";
import { MissedActionsDto } from "./missed-actions.dto";
import { PlatformTenureCohortStatsDto } from "./platform-tenure-cohort.dto";
import { ReminderGroupClickRatePointDto } from "./reminder-group-click-rates.dto";
import { TimeToChurnSampleDto } from "./time-to-churn.dto";
import { TimeSpentForUserDto } from "./timespent.dto";

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("time-spent-per-user")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [TimeSpentForUserDto] })
  async getTimeSpentPerUserAdmin(): Promise<TimeSpentForUserDto[]> {
    const entries = await this.analyticsService.getTimeSpentPerUser();
    return entries.map((entry) => new TimeSpentForUserDto(entry));
  }

  @Get("time-spent-per-user-total")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [TimeSpentForUserDto] })
  async getTimeSpentPerUserTotalAdmin(): Promise<TimeSpentForUserDto[]> {
    const entries = await this.analyticsService.getTimeSpentPerUserTotal();
    return entries.map((entry) => new TimeSpentForUserDto(entry));
  }

  @UseGuards(AdminGuard)
  @Get("daily-stats")
  @ApiOkResponse({ type: [DailyStatsDto] })
  async getDailyStatsAdmin(
    @Query("date") startDate: string,
    @Query("endDate") endDate: string,
  ): Promise<DailyStatsDto[]> {
    const records = await this.analyticsService.getDailyStats(
      startDate,
      endDate,
    );
    return records.map((record) => new DailyStatsDto(record));
  }

  @UseGuards(AdminGuard)
  @Get("action-stats")
  @ApiOkResponse({ type: [ActionStatsWithOnboardingDto] })
  async getActionStatsAdmin(): Promise<ActionStatsWithOnboardingDto[]> {
    const stats = await this.analyticsService.getActionStats();
    return stats.map((stat) => new ActionStatsWithOnboardingDto(stat));
  }

  @UseGuards(AdminGuard)
  @Get("reminder-group-click-rates")
  @ApiOkResponse({ type: [ReminderGroupClickRatePointDto] })
  async getReminderGroupClickRatesAdmin(): Promise<
    ReminderGroupClickRatePointDto[]
  > {
    const points = await this.analyticsService.getReminderGroupClickRates();
    return points.map((point) => new ReminderGroupClickRatePointDto(point));
  }

  @UseGuards(AdminGuard)
  @Get("action-stats/:actionId")
  @ApiOkResponse({ type: ActionStatsWithOnboardingDto })
  async getActionStatsByIdAdmin(
    @Param("actionId") actionId: string,
  ): Promise<ActionStatsWithOnboardingDto> {
    const stats = await this.analyticsService.getActionStatsById(
      Number(actionId),
    );
    if (!stats) {
      throw new NotFoundException("Action stats not found");
    }
    return new ActionStatsWithOnboardingDto(stats);
  }

  @UseGuards(AdminGuard)
  @Post("action-stats/recalculate")
  @ApiOkResponse({ type: [ActionStatsWithOnboardingDto] })
  async recalculateActionStatsAdmin(): Promise<ActionStatsWithOnboardingDto[]> {
    await this.analyticsService.calculateActionStats();
    const stats = await this.analyticsService.getActionStats();
    return stats.map((stat) => new ActionStatsWithOnboardingDto(stat));
  }

  @UseGuards(AdminGuard)
  @Get("member-completion-retention")
  @ApiOkResponse({ type: [MemberCompletionRetentionCohortDto] })
  async getMemberCompletionRetentionAdmin(): Promise<
    MemberCompletionRetentionCohortDto[]
  > {
    const cohorts =
      await this.analyticsService.getMemberCompletionRetentionByCohort();
    return cohorts.map(
      (cohort) => new MemberCompletionRetentionCohortDto(cohort),
    );
  }

  @UseGuards(AdminGuard)
  @Get("member-reliability-window")
  @ApiOkResponse({ type: MemberReliabilityWindowDto })
  @ApiQuery({ name: "weeks", required: true, type: Number })
  async getMemberReliabilityWindowAdmin(
    @Query("weeks") weeks: string,
  ): Promise<MemberReliabilityWindowDto> {
    const parsedWeeks = Number(weeks);
    if (
      !Number.isFinite(parsedWeeks) ||
      !Number.isInteger(parsedWeeks) ||
      parsedWeeks < 1
    ) {
      throw new BadRequestException(
        "weeks must be a whole number of at least 1",
      );
    }
    const stats =
      await this.analyticsService.getMemberReliabilityWindow(parsedWeeks);
    return new MemberReliabilityWindowDto(stats);
  }

  @UseGuards(AdminGuard)
  @Get("missed-actions")
  @ApiOkResponse({ type: MissedActionsDto })
  async getMissedActionsAdmin(): Promise<MissedActionsDto> {
    const stats = await this.analyticsService.getMissedActions();
    return new MissedActionsDto(stats);
  }

  @UseGuards(AdminGuard)
  @Get("platform-tenure-cohort")
  @ApiOkResponse({ type: PlatformTenureCohortStatsDto })
  @ApiQuery({ name: "weeksOnPlatform", required: true, type: Number })
  async getPlatformTenureCohortAdmin(
    @Query("weeksOnPlatform") weeksOnPlatform: string,
  ): Promise<PlatformTenureCohortStatsDto> {
    const parsedWeeks = Number(weeksOnPlatform);
    if (
      !Number.isFinite(parsedWeeks) ||
      parsedWeeks < 0 ||
      !Number.isInteger(parsedWeeks)
    ) {
      throw new BadRequestException("weeksOnPlatform must be a whole number");
    }
    const stats =
      await this.analyticsService.getPlatformTenureCohortStats(parsedWeeks);
    return new PlatformTenureCohortStatsDto(stats);
  }

  @UseGuards(AdminGuard)
  @Get("action-completion-curves")
  @ApiOkResponse({ type: [ActionCompletionCurveDto] })
  @ApiQuery({ name: "actionId", required: false, type: String })
  @ApiQuery({ name: "granularity", required: false, enum: ["daily", "hourly"] })
  async getActionCompletionCurvesAdmin(
    @Query("actionId") actionId?: string,
    @Query("granularity") granularity?: string,
  ): Promise<ActionCompletionCurveDto[]> {
    const parsedActionId = actionId ? Number(actionId) : undefined;
    const parsedGranularity = granularity === "hourly" ? "hourly" : "daily";
    const curves = await this.analyticsService.getActionCompletionCurves(
      parsedActionId,
      parsedGranularity,
    );
    return curves.map((curve) => new ActionCompletionCurveDto(curve));
  }

  @UseGuards(AdminGuard)
  @Get("time-to-churn")
  @ApiOkResponse({ type: [TimeToChurnSampleDto] })
  async getTimeToChurnSamplesAdmin(): Promise<TimeToChurnSampleDto[]> {
    const samples = await this.analyticsService.getTimeToChurnSamples();
    return samples.map((sample) => new TimeToChurnSampleDto(sample));
  }

  @UseGuards(AdminGuard)
  @Get("aggregate-stats")
  @ApiOkResponse({ type: AggregateStatsDto })
  async getAggregateStatsAdmin(): Promise<AggregateStatsDto> {
    const stats = await this.analyticsService.getAggregateStats();
    return new AggregateStatsDto(stats);
  }

  @UseGuards(AdminGuard)
  @Get("invite-funnel")
  @ApiOkResponse({ type: InviteFunnelDto })
  @ApiQuery({ name: "startDate", required: false, type: String })
  @ApiQuery({ name: "endDate", required: false, type: String })
  async getInviteFunnelAdmin(
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ): Promise<InviteFunnelDto> {
    const funnel = await this.analyticsService.getInviteFunnel(
      startDate,
      endDate,
    );
    return new InviteFunnelDto(funnel);
  }

  @UseGuards(AdminGuard)
  @Get("contract-status-history")
  @ApiOkResponse({ type: [ContractStatusPointDto] })
  async getContractStatusHistoryAdmin(
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
  ): Promise<ContractStatusPointDto[]> {
    const points = await this.analyticsService.getContractStatusHistory(
      startDate,
      endDate,
    );
    return points.map((p) => new ContractStatusPointDto(p));
  }
}
