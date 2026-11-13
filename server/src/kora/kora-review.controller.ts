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
  KoraExportSavedDto,
  KoraHomeDto,
  KoraReviewStateDto,
  SaveKoraExportDto,
} from "./dto/kora-review.dto";
import {
  KoraReviewService,
  KoraSaveError,
  type KoraIdentity,
} from "./kora-review.service";
import { KoraSessionService } from "./kora-session.service";

/** For members and participants alike; a member session wins, as on the project page. */
@Controller("kora/review")
@UseGuards(AuthOptionalGuard)
export class KoraReviewController {
  constructor(
    private readonly reviewService: KoraReviewService,
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

  /** The current assignment, creating the first one while the project is active. */
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

  @Put("assignments/:id/export")
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
      assignmentId: id,
      exported: body.export,
    });
    if (!saved.ok) {
      const refusal = saved.error;
      switch (refusal.error) {
        case KoraSaveError.NotFound:
          throw new NotFoundException("Assignment not found");
        case KoraSaveError.Invalid:
          throw new BadRequestException(`The export ${refusal.reason}.`);
        default:
          throw new Error(`unknown refusal: ${refusal satisfies never}`);
      }
    }
    return new KoraExportSavedDto(saved.value);
  }
}
