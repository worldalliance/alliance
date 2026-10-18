import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsObject,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { NotificationChannel } from "src/notifs/notif-utils";
import { NotificationKind, NotificationSection } from "../notification-kind";
import type { ChannelDefaults } from "../notification-preferences.service";

export class ChannelDefaultsDto {
  @ApiProperty()
  inApp: boolean;

  @ApiProperty()
  push: boolean;

  @ApiProperty()
  text: boolean;

  @ApiProperty()
  email: boolean;

  constructor(input: ChannelDefaults) {
    this.inApp = input.inAppByDefault;
    this.push = input.pushByDefault;
    this.text = input.textByDefault;
    this.email = input.emailByDefault;
  }
}

export type NotificationCell = {
  channel: NotificationChannel;
  override: boolean | null;
  enabled: boolean;
  editable: boolean;
};

export class NotificationCellDto {
  @ApiProperty({ enum: NotificationChannel, enumName: "NotificationChannel" })
  channel: NotificationChannel;

  @ApiProperty({
    type: Boolean,
    nullable: true,
    description: "null follows the channel default",
  })
  override: boolean | null;

  @ApiProperty({ description: "Whether the member wants this cell now" })
  enabled: boolean;

  @ApiProperty()
  editable: boolean;

  constructor(input: NotificationCell) {
    this.channel = input.channel;
    this.override = input.override;
    this.enabled = input.enabled;
    this.editable = input.editable;
  }
}

export type KindSettings = {
  kind: NotificationKind;
  label: string;
  section: NotificationSection;
  required: boolean;
  example: string;
  cells: NotificationCell[];
};

export class KindSettingsDto {
  @ApiProperty({ enum: NotificationKind, enumName: "NotificationKind" })
  kind: NotificationKind;

  @ApiProperty()
  label: string;

  @ApiProperty({ enum: NotificationSection, enumName: "NotificationSection" })
  section: NotificationSection;

  @ApiProperty()
  required: boolean;

  @ApiProperty({ description: "What the kind says, with sample names" })
  example: string;

  @ApiProperty({ type: NotificationCellDto, isArray: true })
  cells: NotificationCellDto[];

  constructor(input: KindSettings) {
    this.kind = input.kind;
    this.label = input.label;
    this.section = input.section;
    this.required = input.required;
    this.example = input.example;
    this.cells = input.cells.map((cell) => new NotificationCellDto(cell));
  }
}

export type ChannelReachability = {
  textablePhoneNumber: boolean;
  textStopped: boolean;
};

export class ChannelReachabilityDto {
  @ApiProperty({ description: "A valid phone number is on file" })
  textablePhoneNumber: boolean;

  @ApiProperty({ description: "The number replied STOP" })
  textStopped: boolean;

  constructor(input: ChannelReachability) {
    this.textablePhoneNumber = input.textablePhoneNumber;
    this.textStopped = input.textStopped;
  }
}

export type NotificationSettings = {
  defaults: ChannelDefaults;
  kinds: KindSettings[];
  reachability: ChannelReachability;
};

export class NotificationSettingsDto {
  @ApiProperty({ type: ChannelDefaultsDto })
  defaults: ChannelDefaultsDto;

  @ApiProperty({ type: KindSettingsDto, isArray: true })
  kinds: KindSettingsDto[];

  @ApiProperty({ type: ChannelReachabilityDto })
  reachability: ChannelReachabilityDto;

  constructor(input: NotificationSettings) {
    this.defaults = new ChannelDefaultsDto(input.defaults);
    this.kinds = input.kinds.map((kind) => new KindSettingsDto(kind));
    this.reachability = new ChannelReachabilityDto(input.reachability);
  }
}

export class UpdateChannelDefaultsDto {
  @ApiPropertyOptional()
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  inApp?: boolean;

  @ApiPropertyOptional()
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  push?: boolean;

  @ApiPropertyOptional()
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  text?: boolean;

  @ApiPropertyOptional()
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  email?: boolean;
}

export class UpdateNotificationCellDto {
  @ApiProperty({ enum: NotificationKind, enumName: "NotificationKind" })
  @IsEnum(NotificationKind)
  kind: NotificationKind;

  @ApiProperty({ enum: NotificationChannel, enumName: "NotificationChannel" })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiProperty({
    type: Boolean,
    nullable: true,
    description: "null removes the override so the cell follows the default",
  })
  @ValidateIf((_, value) => value !== null)
  @IsBoolean()
  override: boolean | null;
}

export class UpdateNotificationSettingsDto {
  @ApiPropertyOptional({ type: UpdateChannelDefaultsDto })
  @ValidateIf((_, value) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateChannelDefaultsDto)
  defaults?: UpdateChannelDefaultsDto;

  @ApiPropertyOptional({ type: UpdateNotificationCellDto, isArray: true })
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateNotificationCellDto)
  cells?: UpdateNotificationCellDto[];
}
