import {
  KoraAgeBand,
  KoraChildAgeBand,
  KoraChildAiUse,
  KoraEducation,
  KoraEnglish,
  KoraGender,
  KoraHouseholdIncome,
  KoraUsRegion,
} from "@alliance/common/kora-demographics";
import { ApiProperty, ApiPropertyOptional, PickType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  Equals,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import type { KoraDemographics } from "../entities/kora-reviewer.entity";
import type { KoraOnboarding } from "../kora-reviewer.service";

/** KORA's v6 questionnaire; every answer is nullable because every question is optional. */
export class KoraDemographicsDto implements KoraDemographics {
  @ApiProperty({
    enum: KoraAgeBand,
    enumName: "KoraAgeBand",
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsEnum(KoraAgeBand)
  ageBand: KoraAgeBand | null;

  @ApiProperty({
    enum: KoraGender,
    enumName: "KoraGender",
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsEnum(KoraGender)
  gender: KoraGender | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: "ISO 3166-1 alpha-2",
  })
  @IsOptional()
  @IsString()
  country: string | null;

  @ApiProperty({
    enum: KoraUsRegion,
    enumName: "KoraUsRegion",
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsEnum(KoraUsRegion)
  usRegion: KoraUsRegion | null;

  @ApiProperty({ type: Boolean, nullable: true })
  @IsOptional()
  @IsBoolean()
  isParent: boolean | null;

  @ApiProperty({
    enum: KoraChildAgeBand,
    enumName: "KoraChildAgeBand",
    isArray: true,
  })
  @IsArray()
  @IsEnum(KoraChildAgeBand, { each: true })
  childrenAgeBands: KoraChildAgeBand[];

  @ApiProperty({
    enum: KoraChildAiUse,
    enumName: "KoraChildAiUse",
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsEnum(KoraChildAiUse)
  childAiUse: KoraChildAiUse | null;

  @ApiProperty({ type: Boolean, nullable: true })
  @IsOptional()
  @IsBoolean()
  worksWithChildrenOrHealth: boolean | null;

  @ApiProperty({
    enum: KoraEducation,
    enumName: "KoraEducation",
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsEnum(KoraEducation)
  education: KoraEducation | null;

  @ApiProperty({
    enum: KoraHouseholdIncome,
    enumName: "KoraHouseholdIncome",
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsEnum(KoraHouseholdIncome)
  householdIncome: KoraHouseholdIncome | null;

  @ApiProperty({
    enum: KoraEnglish,
    enumName: "KoraEnglish",
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsEnum(KoraEnglish)
  english: KoraEnglish | null;

  constructor(input: KoraDemographics) {
    this.ageBand = input.ageBand;
    this.gender = input.gender;
    this.country = input.country;
    this.usRegion = input.usRegion;
    this.isParent = input.isParent;
    this.childrenAgeBands = input.childrenAgeBands;
    this.childAiUse = input.childAiUse;
    this.worksWithChildrenOrHealth = input.worksWithChildrenOrHealth;
    this.education = input.education;
    this.householdIncome = input.householdIncome;
    this.english = input.english;
  }
}

export class KoraOnboardingDto {
  @ApiProperty({ type: () => KoraDemographicsDto, nullable: true })
  demographics: KoraDemographicsDto | null;

  @ApiProperty({ type: Date, nullable: true })
  consentAt: Date | null;

  @ApiProperty({
    type: Date,
    nullable: true,
    description: "Set once the reviewer has passed every sign-up screen",
  })
  onboardedAt: Date | null;

  constructor(input: KoraOnboarding) {
    this.demographics = input.demographics
      ? new KoraDemographicsDto(input.demographics)
      : null;
    this.consentAt = input.consentAt;
    this.onboardedAt = input.onboardedAt;
  }
}

/** The same answers arriving, where class-transformer builds the instance itself. */
export class SendKoraDemographicsDto extends PickType(KoraDemographicsDto, [
  "ageBand",
  "gender",
  "country",
  "usRegion",
  "isParent",
  "childrenAgeBands",
  "childAiUse",
  "worksWithChildrenOrHealth",
  "education",
  "householdIncome",
  "english",
]) {}

/** One sign-up screen's answer. Consent is only ever given; withdrawing it deletes the account. */
export class UpdateKoraOnboardingDto {
  @ApiPropertyOptional({ type: () => SendKoraDemographicsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SendKoraDemographicsDto)
  demographics?: SendKoraDemographicsDto;

  @ApiPropertyOptional({ description: "Only ever true" })
  @IsOptional()
  @Equals(true)
  consented?: true;

  @ApiPropertyOptional({ description: "Only ever true" })
  @IsOptional()
  @Equals(true)
  onboarded?: true;
}
