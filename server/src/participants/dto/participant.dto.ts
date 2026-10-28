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
import { ProjectParticipant } from "../entities/project-participant.entity";

export const INVALID_CONTACT = "Enter a valid email address or mobile number.";

export class StartProjectParticipantCodeDto {
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

export class VerifyProjectParticipantCodeDto extends DetectedTimeZoneDto {
  @ApiProperty()
  @IsString()
  @Matches(new RegExp(`^\\d{${OTP_CODE_LENGTH}}$`), {
    message: WRONG_CODE_MESSAGE,
  })
  code: string;
}

export class CompleteProjectParticipantSignupDto extends DetectedTimeZoneDto {
  @ApiProperty({ maxLength: 200 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: "Enter your full name." })
  @MaxLength(200)
  name: string;
}

export class ProjectParticipantDto extends PickType(ProjectParticipant, [
  "id",
  "name",
]) {
  constructor(input: ProjectParticipant) {
    super();
    this.id = input.id;
    this.name = input.name;
  }
}

export class PendingProjectParticipantCodeDto {
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

export class ProjectParticipantCodeVerifiedDto {
  @ApiProperty({
    type: () => ProjectParticipantDto,
    nullable: true,
    description: "Null when the new participant still has to give a name",
  })
  participant: ProjectParticipantDto | null;

  constructor(participant: ProjectParticipant | null) {
    this.participant = participant && new ProjectParticipantDto(participant);
  }
}

export type ProjectParticipantState = {
  participant: ProjectParticipant | null;
  pendingCode: PendingOtp | null;
  signupPending: boolean;
};

export class ProjectParticipantStateDto {
  @ApiProperty({ type: () => ProjectParticipantDto, nullable: true })
  participant: ProjectParticipantDto | null;

  @ApiProperty({
    type: () => PendingProjectParticipantCodeDto,
    nullable: true,
    description: "A code this browser asked for and has not used",
  })
  pendingCode: PendingProjectParticipantCodeDto | null;

  @ApiProperty({ description: "A verified contact is waiting on a name" })
  signupPending: boolean;

  constructor(input: ProjectParticipantState) {
    this.participant =
      input.participant && new ProjectParticipantDto(input.participant);
    this.pendingCode =
      input.pendingCode &&
      new PendingProjectParticipantCodeDto(input.pendingCode);
    this.signupPending = input.signupPending;
  }
}
