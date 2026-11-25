import { OTP_CODE_LENGTH } from "@alliance/common/otp";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, Matches } from "class-validator";
import { maskDestination } from "src/otp/mask-destination";
import { WRONG_CODE_MESSAGE } from "src/otp/otp-refusal";
import type { StartedOtp } from "src/otp/otp.service";
import { IsE164 } from "src/utils/phone";

export class StartPhoneCodeDto {
  @ApiProperty({ description: "E.164" })
  @IsE164()
  phoneNumber: string;
}

export class VerifyPhoneCodeDto {
  @ApiProperty({ description: "From the response that sent the code" })
  @IsString()
  @IsNotEmpty()
  challengeToken: string;

  @ApiProperty()
  @IsString()
  @Matches(new RegExp(`^\\d{${OTP_CODE_LENGTH}}$`), {
    message: WRONG_CODE_MESSAGE,
  })
  code: string;
}

export class PendingPhoneCodeDto {
  @ApiProperty({ description: "Send back with the code to verify it" })
  challengeToken: string;

  @ApiProperty({ description: "Where the code went, partly hidden" })
  maskedDestination: string;

  @ApiProperty({ type: Date })
  resendAvailableAt: Date;

  @ApiProperty({ type: Date })
  expiresAt: Date;

  constructor(input: StartedOtp) {
    this.challengeToken = input.browserToken;
    this.maskedDestination = maskDestination(input.pending);
    this.resendAvailableAt = input.pending.resendAvailableAt;
    this.expiresAt = input.pending.expiresAt;
  }
}
