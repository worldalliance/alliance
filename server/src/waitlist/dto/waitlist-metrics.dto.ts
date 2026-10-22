import { ApiProperty } from "@nestjs/swagger";
import {
  type WaitlistNamedRef,
  WaitlistNamedRefDto,
} from "./waitlist-entry-admin.dto";

export type WaitlistStatusCounts = {
  entries: number;
  waiting: number;
  mobilized: number;
  inviteClaimed: number;
  inviteClaims: number;
};

export class WaitlistStatusCountsDto {
  @ApiProperty()
  entries: number;

  @ApiProperty()
  waiting: number;

  @ApiProperty()
  mobilized: number;

  @ApiProperty({ description: "Entries an account claimed an invite of" })
  inviteClaimed: number;

  @ApiProperty({
    description: "Claimed invites of the selected entries, one per account",
  })
  inviteClaims: number;

  constructor(input: WaitlistStatusCounts) {
    this.entries = input.entries;
    this.waiting = input.waiting;
    this.mobilized = input.mobilized;
    this.inviteClaimed = input.inviteClaimed;
    this.inviteClaims = input.inviteClaims;
  }
}

export type WaitlistInviteEmailCounts = {
  emailed: number;
  claimed: number;
  timedClaims: number;
  medianSecondsToClaim: number | null;
};

export class WaitlistInviteEmailCountsDto {
  @ApiProperty({
    description: "Entries the mail server accepted an email with an invite for",
  })
  emailed: number;

  @ApiProperty({
    description: "Of those entries, how many had an invite claimed",
  })
  claimed: number;

  @ApiProperty({
    description:
      "Emailed entries with an invite claimed after their first invite email",
  })
  timedClaims: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      "Median time from an entry's first accepted invite email to its first claim after it",
  })
  medianSecondsToClaim: number | null;

  constructor(input: WaitlistInviteEmailCounts) {
    this.emailed = input.emailed;
    this.claimed = input.claimed;
    this.timedClaims = input.timedClaims;
    this.medianSecondsToClaim = input.medianSecondsToClaim;
  }
}

export type WaitlistMetricsWeek = {
  weekStart: string;
  entries: number;
  claims: number;
};

export class WaitlistMetricsWeekDto {
  @ApiProperty({ description: "The week's Monday, as a UTC date" })
  weekStart: string;

  @ApiProperty({ description: "Entries that joined that week" })
  entries: number;

  @ApiProperty({ description: "Invites claimed that week" })
  claims: number;

  constructor(input: WaitlistMetricsWeek) {
    this.weekStart = input.weekStart;
    this.entries = input.entries;
    this.claims = input.claims;
  }
}

export type WaitlistMetricsLink = {
  id: number;
  channel: string;
  publishedAt: Date | null;
};

export class WaitlistMetricsLinkDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  channel: string;

  @ApiProperty({ type: Date, nullable: true })
  publishedAt: Date | null;

  constructor(input: WaitlistMetricsLink) {
    this.id = input.id;
    this.channel = input.channel;
    this.publishedAt = input.publishedAt;
  }
}

export type WaitlistMetricsSource = {
  organization: WaitlistNamedRef | null;
  link: WaitlistMetricsLink | null;
  entries: number;
  claims: number;
};

export class WaitlistMetricsSourceDto {
  @ApiProperty({ type: () => WaitlistNamedRefDto, nullable: true })
  organization: WaitlistNamedRefDto | null;

  @ApiProperty({ type: () => WaitlistMetricsLinkDto, nullable: true })
  link: WaitlistMetricsLinkDto | null;

  @ApiProperty()
  entries: number;

  @ApiProperty()
  claims: number;

  constructor(input: WaitlistMetricsSource) {
    this.organization = input.organization
      ? new WaitlistNamedRefDto(input.organization)
      : null;
    this.link = input.link ? new WaitlistMetricsLinkDto(input.link) : null;
    this.entries = input.entries;
    this.claims = input.claims;
  }
}

export type WaitlistMetricsConversion = {
  organization: WaitlistNamedRef | null;
  group: WaitlistNamedRef | null;
  claims: number;
  contractSigned: number;
  firstAction: number;
};

export class WaitlistMetricsConversionDto {
  @ApiProperty({ type: () => WaitlistNamedRefDto, nullable: true })
  organization: WaitlistNamedRefDto | null;

  @ApiProperty({
    type: () => WaitlistNamedRefDto,
    nullable: true,
    description: "The claimed invite's destination group",
  })
  group: WaitlistNamedRefDto | null;

  @ApiProperty()
  claims: number;

  @ApiProperty({ description: "Claimants who signed a contract" })
  contractSigned: number;

  @ApiProperty({
    description:
      "Claimants who completed an action other than contract signing, onboarding actions included",
  })
  firstAction: number;

  constructor(input: WaitlistMetricsConversion) {
    this.organization = input.organization
      ? new WaitlistNamedRefDto(input.organization)
      : null;
    this.group = input.group ? new WaitlistNamedRefDto(input.group) : null;
    this.claims = input.claims;
    this.contractSigned = input.contractSigned;
    this.firstAction = input.firstAction;
  }
}

export type WaitlistMetrics = {
  status: WaitlistStatusCounts;
  inviteEmails: WaitlistInviteEmailCounts;
  weeks: WaitlistMetricsWeek[];
  sources: WaitlistMetricsSource[];
  conversions: WaitlistMetricsConversion[];
};

/** Every count covers only the entries matching the filter. */
export class WaitlistMetricsDto {
  @ApiProperty({ type: () => WaitlistStatusCountsDto })
  status: WaitlistStatusCountsDto;

  @ApiProperty({ type: () => WaitlistInviteEmailCountsDto })
  inviteEmails: WaitlistInviteEmailCountsDto;

  @ApiProperty({ type: () => WaitlistMetricsWeekDto, isArray: true })
  weeks: WaitlistMetricsWeekDto[];

  @ApiProperty({ type: () => WaitlistMetricsSourceDto, isArray: true })
  sources: WaitlistMetricsSourceDto[];

  @ApiProperty({ type: () => WaitlistMetricsConversionDto, isArray: true })
  conversions: WaitlistMetricsConversionDto[];

  constructor(input: WaitlistMetrics) {
    this.status = new WaitlistStatusCountsDto(input.status);
    this.inviteEmails = new WaitlistInviteEmailCountsDto(input.inviteEmails);
    this.weeks = input.weeks.map((week) => new WaitlistMetricsWeekDto(week));
    this.sources = input.sources.map(
      (source) => new WaitlistMetricsSourceDto(source),
    );
    this.conversions = input.conversions.map(
      (conversion) => new WaitlistMetricsConversionDto(conversion),
    );
  }
}
