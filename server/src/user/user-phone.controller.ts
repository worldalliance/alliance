import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiNoContentResponse, ApiOkResponse } from "@nestjs/swagger";
import type { Request } from "express";
import { isAllowedOrigin } from "src/auth/allowed-origins";
import type { JwtRequest } from "src/auth/tokens";
import { clientIp } from "src/otp/client-ip";
import { otpRefusalException } from "src/otp/otp-refusal";
import { AuthGuard } from "../auth/guards/auth.guard";
import {
  PendingPhoneCodeDto,
  StartPhoneCodeDto,
  VerifyPhoneCodeDto,
} from "./dto/phone-verification.dto";
import { PhoneOptInService } from "./phone-opt-in.service";
import {
  PHONE_PURPOSE,
  PhoneVerificationService,
} from "./phone-verification.service";

/** Null for the mobile app, which sends no Origin and has no page to autofill. */
function webOtpHost(req: Request): string | null {
  const origin = req.headers.origin;
  return origin && isAllowedOrigin(origin) ? new URL(origin).host : null;
}

@Controller("user/phone")
@UseGuards(AuthGuard)
export class UserPhoneController {
  constructor(
    private readonly phoneVerificationService: PhoneVerificationService,
    private readonly phoneOptInService: PhoneOptInService,
  ) {}

  @Post("code")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: PendingPhoneCodeDto })
  async sendCode(
    @Body() dto: StartPhoneCodeDto,
    @Req() req: Request,
  ): Promise<PendingPhoneCodeDto> {
    const started = await this.phoneVerificationService.start({
      phoneNumber: dto.phoneNumber,
      ip: clientIp(req),
      webOtpHost: webOtpHost(req),
    });
    if (!started.ok) {
      throw otpRefusalException(started.error, PHONE_PURPOSE);
    }
    return new PendingPhoneCodeDto(started.value);
  }

  @Post("code/verify")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async verifyCode(
    @Body() dto: VerifyPhoneCodeDto,
    @Req() req: JwtRequest,
  ): Promise<void> {
    const verified = await this.phoneVerificationService.verify({
      userId: req.user.sub,
      challengeToken: dto.challengeToken,
      code: dto.code,
      ip: clientIp(req),
    });
    if (!verified.ok) {
      throw otpRefusalException(verified.error, PHONE_PURPOSE);
    }
    await this.phoneOptInService.confirm(req.user.sub);
  }
}
