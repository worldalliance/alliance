import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import type { Response } from "express";
import { AllowedOriginGuard } from "src/auth/guards/allowed-origin.guard";
import { AuthOptionalGuard } from "src/auth/guards/authoptional.guard";
import type { JwtRequest } from "src/auth/tokens";
import {
  KoraOnboardingDto,
  UpdateKoraOnboardingDto,
} from "./dto/kora-onboarding.dto";
import {
  KoraExportSavedDto,
  KoraHomeDto,
  KoraNextConversationDto,
  KoraPreferencesDto,
  KoraReviewStateDto,
  SaveKoraExportDto,
  UpdateKoraPreferencesDto,
} from "./dto/kora-review.dto";
import { KoraReviewService, KoraSaveError } from "./kora-review.service";
import {
  type KoraIdentity,
  KoraReviewerService,
} from "./kora-reviewer.service";
import { KoraSessionService } from "./kora-session.service";

/** For members and participants alike; a member session wins, as on the project page. */
@Controller("kora/review")
@UseGuards(AuthOptionalGuard)
export class KoraReviewController {
  constructor(
    private readonly reviewService: KoraReviewService,
    private readonly reviewers: KoraReviewerService,
    private readonly sessionService: KoraSessionService,
  ) {}

  private async identity(
    req: JwtRequest,
    res: Response,
  ): Promise<KoraIdentity> {
    const userId = req.user?.sub;
    if (userId !== undefined) return { userId };
    const participant = await this.sessionService.current(req, res);
    if (participant) return { participantId: participant.id };
    throw new UnauthorizedException("Sign in to review.");
  }

  /** The open session, starting the first one while the project is active. */
  @Get()
  @ApiOkResponse({ type: KoraReviewStateDto })
  async state(
    @Req() req: JwtRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<KoraReviewStateDto> {
    return new KoraReviewStateDto(
      await this.reviewService.state(await this.identity(req, res)),
    );
  }

  /** The participant's user-batches and any offer, without starting one. */
  @Get("home")
  @ApiOkResponse({ type: KoraHomeDto })
  async home(
    @Req() req: JwtRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<KoraHomeDto> {
    return new KoraHomeDto(
      await this.reviewService.home(await this.identity(req, res)),
    );
  }

  @Post("more")
  @UseGuards(AllowedOriginGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: KoraReviewStateDto })
  async more(
    @Req() req: JwtRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<KoraReviewStateDto> {
    return new KoraReviewStateDto(
      await this.reviewService.more(await this.identity(req, res)),
    );
  }

  @Patch("onboarding")
  @UseGuards(AllowedOriginGuard)
  @ApiOkResponse({ type: KoraOnboardingDto })
  async onboarding(
    @Body() body: UpdateKoraOnboardingDto,
    @Req() req: JwtRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<KoraOnboardingDto> {
    return new KoraOnboardingDto(
      await this.reviewers.onboarding({
        identity: await this.identity(req, res),
        demographics: body.demographics,
        consented: body.consented,
        onboarded: body.onboarded,
      }),
    );
  }

  @Patch("preferences")
  @UseGuards(AllowedOriginGuard)
  @ApiOkResponse({ type: KoraPreferencesDto })
  async preferences(
    @Body() body: UpdateKoraPreferencesDto,
    @Req() req: JwtRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<KoraPreferencesDto> {
    return new KoraPreferencesDto(
      await this.reviewers.preferences({
        identity: await this.identity(req, res),
        optOutRisks: body.optOutRisks,
        extendedOptIn: body.extendedOptIn,
      }),
    );
  }

  @Put("sessions/:id/export")
  @UseGuards(AllowedOriginGuard)
  @ApiOkResponse({ type: KoraExportSavedDto })
  async save(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: SaveKoraExportDto,
    @Req() req: JwtRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<KoraExportSavedDto> {
    const saved = await this.reviewService.save({
      identity: await this.identity(req, res),
      sessionId: id,
      exported: body.export,
    });
    if (!saved.ok) {
      const refusal = saved.error;
      switch (refusal.error) {
        case KoraSaveError.NotFound:
          throw new NotFoundException("Session not found");
        case KoraSaveError.Invalid:
          throw new BadRequestException(`The export ${refusal.reason}.`);
        default:
          throw new Error(`unknown refusal: ${refusal satisfies never}`);
      }
    }
    return new KoraExportSavedDto(saved.value);
  }

  @Post("sessions/:id/next")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AllowedOriginGuard)
  @ApiOkResponse({ type: KoraNextConversationDto })
  async next(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: JwtRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<KoraNextConversationDto> {
    const next = await this.reviewService.next({
      identity: await this.identity(req, res),
      sessionId: id,
    });
    if (!next.ok) throw new NotFoundException("Session not found");
    return new KoraNextConversationDto(next.value);
  }
}
