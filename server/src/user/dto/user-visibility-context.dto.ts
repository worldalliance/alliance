import { type UserPropertyPresence } from "@alliance/common/forms/user-properties";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class UserPropertyPresenceDto implements UserPropertyPresence {
  @ApiProperty() name: boolean;
  @ApiProperty() email: boolean;
  @ApiProperty() phoneNumber: boolean;
  @ApiProperty() preferredReminderTime: boolean;
  @ApiProperty() timeZone: boolean;
  @ApiProperty() profilePicture: boolean;
  @ApiProperty() profileDescription: boolean;
  @ApiProperty() city: boolean;
  @ApiProperty() customCityString: boolean;
  @ApiProperty() over18: boolean;
  @ApiProperty() clusterId: boolean;
  @ApiProperty() staffTitle: boolean;
  @ApiProperty() switchedDomainAt: boolean;
  @ApiProperty() referredById: boolean;
  @ApiProperty() shareInfoPublicly: boolean;

  constructor(input: UserPropertyPresence) {
    this.name = input.name;
    this.email = input.email;
    this.phoneNumber = input.phoneNumber;
    this.preferredReminderTime = input.preferredReminderTime;
    this.timeZone = input.timeZone;
    this.profilePicture = input.profilePicture;
    this.profileDescription = input.profileDescription;
    this.city = input.city;
    this.customCityString = input.customCityString;
    this.over18 = input.over18;
    this.clusterId = input.clusterId;
    this.staffTitle = input.staffTitle;
    this.switchedDomainAt = input.switchedDomainAt;
    this.referredById = input.referredById;
    this.shareInfoPublicly = input.shareInfoPublicly;
  }
}

export type MyVisibilityContext = {
  userHasCity: boolean;
  userPropertyHasValue: UserPropertyPresence;
  firstContractSignedAt: Date | null;
  completedActionCount: number;
};

/**
 * User-account-derived values consumed by form visibility conditions
 * (`userHasCity`, `userPropertyHasValue`, `firstContractSigned`,
 * `completedActionCount`). Mirrors the server-side extras used when stripping
 * hidden answers at submission, so clients preview the same visibility the
 * server enforces.
 */
export class MyVisibilityContextDto {
  @ApiProperty()
  userHasCity: boolean;

  @ApiProperty({ type: () => UserPropertyPresenceDto })
  userPropertyHasValue: UserPropertyPresenceDto;

  @ApiPropertyOptional({ type: Date })
  firstContractSignedAt?: Date;

  @ApiProperty()
  completedActionCount: number;

  constructor(input: MyVisibilityContext) {
    this.userHasCity = input.userHasCity;
    this.userPropertyHasValue = new UserPropertyPresenceDto(
      input.userPropertyHasValue,
    );
    this.firstContractSignedAt = input.firstContractSignedAt ?? undefined;
    this.completedActionCount = input.completedActionCount;
  }
}
