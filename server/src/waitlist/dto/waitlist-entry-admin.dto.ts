import { BadRequestException } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  plainToInstance,
  Transform,
  type TransformFnParams,
  Type,
} from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
  validateSync,
} from "class-validator";
import { ContractEventDto } from "src/user/dto/user.dto";
import type { ContractEvent } from "src/user/entities/contract-event.entity";
import { toDateTime, trimToNull } from "src/utils/transforms";
import {
  type WaitlistEntry,
  WaitlistSpamStatus,
} from "../entities/waitlist-entry.entity";
import type { WaitlistLink } from "../entities/waitlist-link.entity";
import type { WaitlistTag } from "../entities/waitlist-tag.entity";
import { WaitlistTagDto } from "./waitlist-tag.dto";

/**
 * Claimed if an account references any of the entry's invites, else unused if
 * any is still claimable, else revoked if any was issued, else none.
 */
export enum WaitlistInviteState {
  None = "none",
  Unused = "unused",
  Claimed = "claimed",
  Revoked = "revoked",
}

export enum WaitlistContactMethod {
  Email = "email",
  Phone = "phone",
}

export enum WaitlistEntrySort {
  JoinedDesc = "joined_desc",
  JoinedAsc = "joined_asc",
  OrganizationAsc = "organization_asc",
  OrganizationDesc = "organization_desc",
}

/**
 * Fields combine with AND; the values of one list field combine with OR, and
 * an empty list filters nothing. Saved cohorts store this as jsonb, so
 * removing, renaming, or narrowing a field needs a migration of
 * `waitlist_cohort.filter`.
 */
export class WaitlistEntryFilterDto {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      "Matches part of a name or email, or, when the text looks like a phone number, part of a phone number's digits ignoring punctuation",
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(200)
  search?: string | null;

  @ApiPropertyOptional({ type: Number, isArray: true })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  organizationIds?: number[];

  @ApiPropertyOptional({ type: Number, isArray: true })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  sourceLinkIds?: number[];

  @ApiPropertyOptional({ type: Number, isArray: true })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  referrerIds?: number[];

  // eslint-disable-next-line @darraghor/nestjs-typed/validated-non-primitive-property-needs-type-decorator -- toDateTime converts; @Type(() => Date) would parse loosely
  @ApiPropertyOptional({ type: String, format: "date-time" })
  @IsOptional()
  @Transform(toDateTime)
  @IsDate()
  joinedFrom?: Date;

  // eslint-disable-next-line @darraghor/nestjs-typed/validated-non-primitive-property-needs-type-decorator -- toDateTime converts; @Type(() => Date) would parse loosely
  @ApiPropertyOptional({ type: String, format: "date-time" })
  @IsOptional()
  @Transform(toDateTime)
  @IsDate()
  joinedBefore?: Date;

  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  mobilized?: boolean;

  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  subscribed?: boolean;

  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  hasReason?: boolean;

  @ApiPropertyOptional({
    type: Number,
    isArray: true,
    description: "Entries with any of these tags",
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  tagIds?: number[];

  @ApiPropertyOptional({
    enum: WaitlistInviteState,
    enumName: "WaitlistInviteState",
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(WaitlistInviteState, { each: true })
  inviteStates?: WaitlistInviteState[];

  @ApiPropertyOptional({
    enum: WaitlistSpamStatus,
    enumName: "WaitlistSpamStatus",
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(WaitlistSpamStatus, { each: true })
  spamStatuses?: WaitlistSpamStatus[];

  @ApiPropertyOptional({
    enum: WaitlistContactMethod,
    enumName: "WaitlistContactMethod",
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(WaitlistContactMethod)
  contactMethod?: WaitlistContactMethod;
}

/**
 * Refuses a filter with fields the list doesn't take. Whitelisting would drop
 * them silently, so the filter would match more entries than the caller meant.
 */
export const rejectUnknownFilterFields = ({
  key,
  obj,
  value,
}: TransformFnParams): unknown => {
  const raw: unknown = obj[key];
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return value;
  }
  const unknown = validateSync(plainToInstance(WaitlistEntryFilterDto, raw), {
    whitelist: true,
    forbidNonWhitelisted: true,
  })
    .filter((error) => error.constraints?.whitelistValidation)
    .map((error) => error.property);
  if (unknown.length) {
    throw new BadRequestException(
      `Unknown filter fields: ${unknown.join(", ")}`,
    );
  }
  return value;
};

export class WaitlistEntryFilterBodyDto {
  @ApiProperty({ type: () => WaitlistEntryFilterDto })
  @Transform(rejectUnknownFilterFields)
  @IsObject()
  @ValidateNested()
  @Type(() => WaitlistEntryFilterDto)
  filter: WaitlistEntryFilterDto;
}

export class WaitlistEntrySearchDto extends WaitlistEntryFilterBodyDto {
  @ApiProperty({ enum: WaitlistEntrySort, enumName: "WaitlistEntrySort" })
  @IsEnum(WaitlistEntrySort)
  sort: WaitlistEntrySort;

  @ApiProperty()
  @IsInt()
  @Min(0)
  offset: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(200)
  limit: number;
}

export type WaitlistNamedRef = { id: number; name: string };

export class WaitlistNamedRefDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  constructor(input: WaitlistNamedRef) {
    this.id = input.id;
    this.name = input.name;
  }
}

export class WaitlistSourceLinkDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  channel: string;

  constructor(input: WaitlistLink) {
    this.id = input.id;
    this.channel = input.channel;
  }
}

export type AdminWaitlistEntry = {
  entry: WaitlistEntry;
  inviteState: WaitlistInviteState;
  tags: WaitlistTag[];
  contractEvents: ContractEvent[];
};

export class AdminWaitlistEntryDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: String, nullable: true })
  email: string | null;

  @ApiProperty({ type: String, nullable: true, description: "E.164" })
  phoneNumber: string | null;

  @ApiProperty({ description: "The personal code others join through" })
  shareCode: string;

  @ApiProperty({ type: String, nullable: true })
  reason: string | null;

  @ApiProperty({ type: () => WaitlistNamedRefDto, nullable: true })
  organization: WaitlistNamedRefDto | null;

  @ApiProperty({ type: () => WaitlistSourceLinkDto, nullable: true })
  sourceLink: WaitlistSourceLinkDto | null;

  @ApiProperty({ type: () => WaitlistNamedRefDto, nullable: true })
  referrer: WaitlistNamedRefDto | null;

  @ApiProperty({ type: Date })
  createdAt: Date;

  @ApiProperty({ type: Date, nullable: true })
  mobilizedAt: Date | null;

  @ApiProperty({ type: Date, nullable: true })
  unsubscribedAt: Date | null;

  @ApiProperty({ enum: WaitlistSpamStatus, enumName: "WaitlistSpamStatus" })
  spamStatus: WaitlistSpamStatus;

  @ApiProperty({ enum: WaitlistInviteState, enumName: "WaitlistInviteState" })
  inviteState: WaitlistInviteState;

  @ApiProperty({ type: () => WaitlistTagDto, isArray: true })
  tags: WaitlistTagDto[];

  @ApiProperty({ type: () => ContractEventDto, isArray: true })
  contractEvents: ContractEventDto[];

  constructor(input: AdminWaitlistEntry) {
    const { entry } = input;
    this.id = entry.id;
    this.name = entry.name;
    this.email = entry.email;
    this.phoneNumber = entry.phoneNumber;
    this.shareCode = entry.code;
    this.reason = entry.reason;
    this.organization = entry.organization
      ? new WaitlistNamedRefDto(entry.organization)
      : null;
    this.sourceLink = entry.sourceLink
      ? new WaitlistSourceLinkDto(entry.sourceLink)
      : null;
    this.referrer = entry.referrer
      ? new WaitlistNamedRefDto(entry.referrer)
      : null;
    this.createdAt = entry.createdAt;
    this.mobilizedAt = entry.mobilizedAt;
    this.unsubscribedAt = entry.unsubscribedAt;
    this.spamStatus = entry.spamStatus;
    this.inviteState = input.inviteState;
    this.contractEvents = input.contractEvents.map(
      (event) => new ContractEventDto(event),
    );
    this.tags = input.tags.map((tag) => new WaitlistTagDto(tag));
  }
}

export type WaitlistEntryPage = {
  entries: AdminWaitlistEntry[];
  total: number;
};

export class WaitlistEntryPageDto {
  @ApiProperty({ type: () => AdminWaitlistEntryDto, isArray: true })
  entries: AdminWaitlistEntryDto[];

  @ApiProperty({ description: "Entries matching the filter, on every page" })
  total: number;

  constructor(input: WaitlistEntryPage) {
    this.entries = input.entries.map(
      (entry) => new AdminWaitlistEntryDto(entry),
    );
    this.total = input.total;
  }
}

export class WaitlistEntryIdsDto {
  @ApiProperty({ type: Number, isArray: true })
  ids: number[];

  constructor(ids: number[]) {
    this.ids = ids;
  }
}

export class WaitlistEntryIdsBodyDto {
  @ApiProperty({ type: Number, isArray: true })
  @IsArray()
  @IsInt({ each: true })
  entryIds: number[];
}

export class WaitlistChangeCountDto {
  @ApiProperty({
    description:
      "How many the request changed: entries, or invites for a revocation",
  })
  changed: number;

  constructor(changed: number) {
    this.changed = changed;
  }
}

export enum WaitlistInvitePlacement {
  Group = "group",
  NoOrganization = "no_organization",
  NoGroup = "no_group",
  FullGroup = "full_group",
}

export type WaitlistEntryInvite = {
  code: string;
  issued: boolean;
  placement: WaitlistInvitePlacement;
};

export class WaitlistEntryInviteDto {
  @ApiProperty({ description: "The claimable signup invite's code" })
  code: string;

  @ApiProperty({ description: "False when an unused invite was reused" })
  issued: boolean;

  @ApiProperty({
    enum: WaitlistInvitePlacement,
    enumName: "WaitlistInvitePlacement",
    description:
      "Where signup places the entrant, by the invite's organization and group",
  })
  placement: WaitlistInvitePlacement;

  constructor(input: WaitlistEntryInvite) {
    this.code = input.code;
    this.issued = input.issued;
    this.placement = input.placement;
  }
}
