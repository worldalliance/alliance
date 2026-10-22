import {
  LinkOpeningPlatform,
  MAX_DESTINATION_LENGTH,
  TRACKING_ID,
} from "@alliance/common/linkOpening";
import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsDate,
  IsEnum,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from "class-validator";
import { toDateTime } from "src/utils/transforms";

export class RecordLinkOpeningDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  openingId: string;

  @ApiProperty()
  @IsString()
  @Matches(TRACKING_ID)
  trackingId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(MAX_DESTINATION_LENGTH)
  @Matches(/^\//)
  destination: string;

  @ApiProperty({ enum: LinkOpeningPlatform, enumName: "LinkOpeningPlatform" })
  @IsEnum(LinkOpeningPlatform)
  platform: LinkOpeningPlatform;

  // eslint-disable-next-line @darraghor/nestjs-typed/validated-non-primitive-property-needs-type-decorator -- toDateTime converts; @Type(() => Date) would parse loosely
  @ApiProperty({ type: String, format: "date-time" })
  @Transform(toDateTime)
  @IsDate()
  observedAt: Date;
}
