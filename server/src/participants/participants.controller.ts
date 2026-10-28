import { OtpError } from "@alliance/common/otp";
import { ParticipantError } from "@alliance/common/participant";
import { R } from "@alliance/common/result";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiNoContentResponse, ApiOkResponse } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { AllowedOriginGuard } from "src/auth/guards/allowed-origin.guard";
import { ParticipantsAvailableGuard } from "src/auth/guards/participants-available.guard";
import { OtpChannel, OtpPurpose } from "src/otp/otp-copy";
import { OTP_TTL_MS } from "src/otp/otp-limits";
import { otpRefusalException } from "src/otp/otp-refusal";
import { type OtpContact, OtpService } from "src/otp/otp.service";
import { readCookie } from "src/utils/cookies";
import {
  CompleteProjectParticipantSignupDto,
  INVALID_CONTACT,
  PendingProjectParticipantCodeDto,
  ProjectParticipantCodeVerifiedDto,
  ProjectParticipantDto,
  ProjectParticipantStateDto,
  StartProjectParticipantCodeDto,
  VerifyProjectParticipantCodeDto,
} from "./dto/participant.dto";
import {
  clearCookie,
  ParticipantCookie,
  setCookie,
} from "./participant-cookies";
import { ParticipantSessionService } from "./participant-session.service";
import { ParticipantService } from "./participant.service";

const PURPOSE = OtpPurpose.ParticipantSignIn;

function contactOf(dto: StartProjectParticipantCodeDto): OtpContact {
  if (dto.email !== undefined && dto.phoneNumber === undefined) {
    return { channel: OtpChannel.Email, destination: dto.email };
  }
  if (dto.phoneNumber !== undefined && dto.email === undefined) {
    return { channel: OtpChannel.Sms, destination: dto.phoneNumber };
  }
  throw new BadRequestException(INVALID_CONTACT);
}

function clientIp(req: Request): string {
  return req.ip ?? "unknown";
}

function webOtpHost(req: Request): string {
  const origin = req.headers.origin;
  if (!origin) {
    throw new Error("sendCode needs AllowedOriginGuard");
  }
  return new URL(origin).host;
}

@Controller("participants")
@UseGuards(ParticipantsAvailableGuard)
export class ParticipantsController {
  constructor(
    private readonly participantService: ParticipantService,
    private readonly sessionService: ParticipantSessionService,
    private readonly otpService: OtpService,
  ) {}

  /** Everything the sign-in card needs to resume after a reload. */
  @Get("me")
  @ApiOkResponse({ type: ProjectParticipantStateDto })
  async state(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ProjectParticipantStateDto> {
    const codeToken = readCookie(req, ParticipantCookie.Code);
    const signupToken = readCookie(req, ParticipantCookie.Signup);
    const [participant, pendingCode, signupPending] = await Promise.all([
      this.sessionService.current(req, res),
      codeToken
        ? this.otpService.pending({ purpose: PURPOSE, browserToken: codeToken })
        : null,
      signupToken ? this.participantService.signupPending(signupToken) : false,
    ]);
    return new ProjectParticipantStateDto({
      participant,
      pendingCode,
      signupPending,
    });
  }

  @Post("code")
  @UseGuards(AllowedOriginGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: PendingProjectParticipantCodeDto })
  async sendCode(
    @Body() dto: StartProjectParticipantCodeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PendingProjectParticipantCodeDto> {
    const started = await this.otpService.start({
      purpose: PURPOSE,
      contact: contactOf(dto),
      ip: clientIp(req),
      webOtpHost: webOtpHost(req),
    });
    if (!started.ok) {
      throw otpRefusalException(started.error);
    }
    setCookie({
      res,
      name: ParticipantCookie.Code,
      token: started.value.browserToken,
      maxAgeMs: OTP_TTL_MS,
    });
    return new PendingProjectParticipantCodeDto(started.value.pending);
  }

  /** Drops this browser's code and any signup awaiting a name. */
  @Delete("code")
  @UseGuards(AllowedOriginGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async abandonCode(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const codeToken = readCookie(req, ParticipantCookie.Code);
    if (codeToken) {
      await this.otpService.abandon({
        purpose: PURPOSE,
        browserToken: codeToken,
      });
    }
    clearCookie(res, ParticipantCookie.Code);
    await this.dropSignup(req, res);
  }

  @Post("code/verify")
  @UseGuards(AllowedOriginGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ProjectParticipantCodeVerifiedDto })
  async verifyCode(
    @Body() dto: VerifyProjectParticipantCodeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ProjectParticipantCodeVerifiedDto> {
    const codeToken = readCookie(req, ParticipantCookie.Code);
    if (!codeToken) {
      throw otpRefusalException({ error: OtpError.CodeInvalid });
    }
    const verified = await this.participantService.verifyCode({
      codeToken,
      code: dto.code,
      ip: clientIp(req),
      timeZone: dto.timeZone ?? null,
    });
    if (!verified.ok) {
      throw otpRefusalException(verified.error);
    }
    clearCookie(res, ParticipantCookie.Code);
    if ("participant" in verified.value) {
      await this.dropSignup(req, res);
      await this.sessionService.begin({
        req,
        res,
        participantId: verified.value.participant.id,
      });
      return new ProjectParticipantCodeVerifiedDto(verified.value.participant);
    }
    setCookie({
      res,
      name: ParticipantCookie.Signup,
      token: verified.value.signupToken,
      maxAgeMs: verified.value.signupTtlMs,
    });
    return new ProjectParticipantCodeVerifiedDto(null);
  }

  @Post("signup")
  @UseGuards(AllowedOriginGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ProjectParticipantDto })
  async completeSignup(
    @Body() dto: CompleteProjectParticipantSignupDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ProjectParticipantDto> {
    const signupToken = readCookie(req, ParticipantCookie.Signup);
    const completed = signupToken
      ? await this.participantService.completeSignup({
          signupToken,
          name: dto.name,
          timeZone: dto.timeZone ?? null,
        })
      : R.failure(ParticipantError.SignupExpired);
    clearCookie(res, ParticipantCookie.Signup);
    if (!completed.ok) {
      throw new BadRequestException(
        "Your verification has expired. Verify your contact again.",
        { description: ParticipantError.SignupExpired },
      );
    }
    await this.sessionService.begin({
      req,
      res,
      participantId: completed.value.id,
    });
    return new ProjectParticipantDto(completed.value);
  }

  /** Ends this browser's participant session only. */
  @Post("sign-out")
  @UseGuards(AllowedOriginGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async signOut(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.sessionService.end(req, res);
  }

  private async dropSignup(req: Request, res: Response): Promise<void> {
    const signupToken = readCookie(req, ParticipantCookie.Signup);
    if (signupToken) {
      await this.participantService.abandonSignup(signupToken);
    }
    clearCookie(res, ParticipantCookie.Signup);
  }
}
