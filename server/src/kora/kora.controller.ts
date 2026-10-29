import { KoraError } from "@alliance/common/kora";
import { OtpError } from "@alliance/common/otp";
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
import { KoraAvailableGuard } from "src/auth/guards/kora-available.guard";
import { OtpChannel, OtpPurpose } from "src/otp/otp-copy";
import { OTP_TTL_MS } from "src/otp/otp-limits";
import { otpRefusalException } from "src/otp/otp-refusal";
import { type OtpContact, OtpService } from "src/otp/otp.service";
import { readCookie } from "src/utils/cookies";
import {
  CompleteKoraSignupDto,
  INVALID_CONTACT,
  KoraCodeVerifiedDto,
  KoraParticipantDto,
  KoraParticipantStateDto,
  PendingKoraCodeDto,
  StartKoraCodeDto,
  VerifyKoraCodeDto,
} from "./dto/kora-participant.dto";
import { clearCookie, KoraCookie, setCookie } from "./kora-cookies";
import { KoraParticipantService } from "./kora-participant.service";
import { KoraSessionService } from "./kora-session.service";

const PURPOSE = OtpPurpose.KoraSignIn;

function contactOf(dto: StartKoraCodeDto): OtpContact {
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

@Controller("kora")
@UseGuards(KoraAvailableGuard)
export class KoraController {
  constructor(
    private readonly participantService: KoraParticipantService,
    private readonly sessionService: KoraSessionService,
    private readonly otpService: OtpService,
  ) {}

  /** Everything the sign-in card needs to resume after a reload. */
  @Get("me")
  @ApiOkResponse({ type: KoraParticipantStateDto })
  async state(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<KoraParticipantStateDto> {
    const codeToken = readCookie(req, KoraCookie.Code);
    const signupToken = readCookie(req, KoraCookie.Signup);
    const [participant, pendingCode, signupPending] = await Promise.all([
      this.sessionService.current(req, res),
      codeToken
        ? this.otpService.pending({ purpose: PURPOSE, browserToken: codeToken })
        : null,
      signupToken ? this.participantService.signupPending(signupToken) : false,
    ]);
    return new KoraParticipantStateDto({
      participant,
      pendingCode,
      signupPending,
    });
  }

  @Post("code")
  @UseGuards(AllowedOriginGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: PendingKoraCodeDto })
  async sendCode(
    @Body() dto: StartKoraCodeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PendingKoraCodeDto> {
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
      name: KoraCookie.Code,
      token: started.value.browserToken,
      maxAgeMs: OTP_TTL_MS,
    });
    return new PendingKoraCodeDto(started.value.pending);
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
    const codeToken = readCookie(req, KoraCookie.Code);
    if (codeToken) {
      await this.otpService.abandon({
        purpose: PURPOSE,
        browserToken: codeToken,
      });
    }
    clearCookie(res, KoraCookie.Code);
    await this.dropSignup(req, res);
  }

  @Post("code/verify")
  @UseGuards(AllowedOriginGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: KoraCodeVerifiedDto })
  async verifyCode(
    @Body() dto: VerifyKoraCodeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<KoraCodeVerifiedDto> {
    const codeToken = readCookie(req, KoraCookie.Code);
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
    clearCookie(res, KoraCookie.Code);
    if ("participant" in verified.value) {
      await this.dropSignup(req, res);
      await this.sessionService.begin({
        req,
        res,
        participantId: verified.value.participant.id,
      });
      return new KoraCodeVerifiedDto(verified.value.participant);
    }
    setCookie({
      res,
      name: KoraCookie.Signup,
      token: verified.value.signupToken,
      maxAgeMs: verified.value.signupTtlMs,
    });
    return new KoraCodeVerifiedDto(null);
  }

  @Post("signup")
  @UseGuards(AllowedOriginGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: KoraParticipantDto })
  async completeSignup(
    @Body() dto: CompleteKoraSignupDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<KoraParticipantDto> {
    const signupToken = readCookie(req, KoraCookie.Signup);
    const completed = signupToken
      ? await this.participantService.completeSignup({
          signupToken,
          name: dto.name,
          timeZone: dto.timeZone ?? null,
        })
      : R.failure(KoraError.SignupExpired);
    clearCookie(res, KoraCookie.Signup);
    if (!completed.ok) {
      throw new BadRequestException(
        "Your verification has expired. Verify your contact again.",
        { description: KoraError.SignupExpired },
      );
    }
    await this.sessionService.begin({
      req,
      res,
      participantId: completed.value.id,
    });
    return new KoraParticipantDto(completed.value);
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
    const signupToken = readCookie(req, KoraCookie.Signup);
    if (signupToken) {
      await this.participantService.abandonSignup(signupToken);
    }
    clearCookie(res, KoraCookie.Signup);
  }
}
