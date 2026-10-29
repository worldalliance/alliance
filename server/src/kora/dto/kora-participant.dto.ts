import { OTP_CODE_LENGTH } from "@alliance/common/otp";
import { ApiProperty, ApiPropertyOptional, PickType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator";
import { maskDestination } from "src/otp/mask-destination";
import { OtpChannel } from "src/otp/otp-copy";
import { WRONG_CODE_MESSAGE } from "src/otp/otp-refusal";
import type { PendingOtp } from "src/otp/otp.service";
import { IsE164 } from "src/utils/phone";
import { IsTimeZoneIdentifier } from "src/utils/timezone";
import { trim } from "src/utils/transforms";
import { KoraParticipant } from "../entities/kora-participant.entity";

export const INVALID_CONTACT = "Enter a valid email address or mobile number.";

export class StartKoraCodeDto {
  @ApiPropertyOptional({ description: "Send this or `phoneNumber`" })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsEmail({}, { message: INVALID_CONTACT })
  @MaxLength(320, { message: INVALID_CONTACT })
  email?: string;

  @ApiPropertyOptional({ description: "E.164; send this or `email`" })
  @ValidateIf((_object, value) => value !== undefined)
  @IsE164({ message: INVALID_CONTACT })
  phoneNumber?: string;
}

class DetectedTimeZoneDto {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "The device's IANA timezone, when it could be detected",
  })
  @IsOptional()
  @IsTimeZoneIdentifier()
  timeZone?: string | null;
}

export class VerifyKoraCodeDto extends DetectedTimeZoneDto {
  @ApiProperty()
  @IsString()
  @Matches(new RegExp(`^\\d{${OTP_CODE_LENGTH}}$`), {
    message: WRONG_CODE_MESSAGE,
  })
  code: string;
}

export class CompleteKoraSignupDto extends DetectedTimeZoneDto {
  @ApiProperty({ maxLength: 200 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: "Enter your full name." })
  @MaxLength(200)
  name: string;
}

export class KoraParticipantDto extends PickType(KoraParticipant, [
  "id",
  "name",
]) {
  constructor(input: KoraParticipant) {
    super();
    this.id = input.id;
    this.name = input.name;
  }
}

export class PendingKoraCodeDto {
  @ApiProperty({ enum: OtpChannel, enumName: "OtpChannel" })
  channel: OtpChannel;

  @ApiProperty({ description: "Where the code went, partly hidden" })
  maskedDestination: string;

  @ApiProperty({ type: Date })
  resendAvailableAt: Date;

  @ApiProperty({ type: Date })
  expiresAt: Date;

  constructor(input: PendingOtp) {
    this.channel = input.channel;
    this.maskedDestination = maskDestination(input);
    this.resendAvailableAt = input.resendAvailableAt;
    this.expiresAt = input.expiresAt;
  }
}

export class KoraCodeVerifiedDto {
  @ApiProperty({
    type: () => KoraParticipantDto,
    nullable: true,
    description: "Null when the new participant still has to give a name",
  })
  participant: KoraParticipantDto | null;

  constructor(participant: KoraParticipant | null) {
    this.participant = participant && new KoraParticipantDto(participant);
  }
}

export type KoraParticipantState = {
  participant: KoraParticipant | null;
  pendingCode: PendingOtp | null;
  signupPending: boolean;
};

export class KoraParticipantStateDto {
  @ApiProperty({ type: () => KoraParticipantDto, nullable: true })
  participant: KoraParticipantDto | null;

  @ApiProperty({
    type: () => PendingKoraCodeDto,
    nullable: true,
    description: "A code this browser asked for and has not used",
  })
  pendingCode: PendingKoraCodeDto | null;

  @ApiProperty({ description: "A verified contact is waiting on a name" })
  signupPending: boolean;

  constructor(input: KoraParticipantState) {
    this.participant =
      input.participant && new KoraParticipantDto(input.participant);
    this.pendingCode =
      input.pendingCode && new PendingKoraCodeDto(input.pendingCode);
    this.signupPending = input.signupPending;
  }
}
