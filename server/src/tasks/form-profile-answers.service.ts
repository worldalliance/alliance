import {
  type CheckboxExtractionTarget,
  type CityFieldValue,
  FormSchema,
} from "@alliance/common/forms/form-schema";
import { toE164 } from "@alliance/common/phone";
import { R } from "@alliance/common/result";
import { isTimeZoneIdentifier } from "@alliance/common/timezone";
import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { updateLive } from "src/datasources/soft-delete";
import { ImagesService } from "src/images/images.service";
import { NotificationSettingsService } from "src/notification-settings/notification-settings.service";
import { UpdateProfileDto } from "src/user/dto/user.dto";
import { User } from "src/user/entities/user.entity";
import { PhoneNumberTakenException } from "src/user/phone-number-taken.exception";
import { PhoneOptInService } from "src/user/phone-opt-in.service";
import { UserService } from "src/user/user.service";
import { toPlainTime } from "src/utils/plain-time";
import { DataSource } from "typeorm";

function getFirstAutoExtractAnswer(
  schema: FormSchema,
  answers: Record<string, unknown>,
  kind:
    | "phone"
    | "time"
    | "timePicker"
    | "timezone"
    | "city"
    | "textarea"
    | "file"
    | "image",
): string | null {
  for (const page of schema.pages ?? []) {
    if (!page.fields) {
      continue;
    }
    for (const field of page.fields) {
      if (kind === "city" && field.kind === "city") {
        if (!field.autoExtractUserData) {
          continue;
        }
        const answer = answers[field.id];
        if (
          answer &&
          typeof answer === "object" &&
          "id" in (answer as CityFieldValue) &&
          typeof (answer as CityFieldValue).id === "number" &&
          Number.isFinite((answer as CityFieldValue).id)
        ) {
          return (answer as CityFieldValue).id.toString();
        }
        if (typeof answer === "string") {
          const value = answer.trim();
          if (value) {
            return value;
          }
        }
        continue;
      }
      if (
        field.kind === kind &&
        field.autoExtractUserData &&
        typeof answers[field.id] === "string"
      ) {
        const value = (answers[field.id] as string).trim();
        if (value) {
          return value;
        }
      }
    }
  }

  return null;
}

function getCheckboxExtractionValue(
  schema: FormSchema,
  answers: Record<string, unknown>,
  target: CheckboxExtractionTarget,
): boolean | null {
  for (const page of schema.pages ?? []) {
    if (!page.fields) {
      continue;
    }
    for (const field of page.fields) {
      if (
        field.kind !== "checkbox" &&
        field.kind !== "toggle" &&
        field.kind !== "custom"
      ) {
        continue;
      }
      if (field.autoExtractUserData?.target !== target) {
        continue;
      }
      const answer = answers[field.id];
      if (typeof answer === "boolean") {
        return answer;
      }
      if (typeof answer === "string") {
        const normalized = answer.trim().toLowerCase();
        if (normalized === "true") {
          return true;
        }
        if (normalized === "false") {
          return false;
        }
      }
    }
  }

  return null;
}

@Injectable()
export class FormProfileAnswersService {
  private readonly logger = new Logger(FormProfileAnswersService.name);
  constructor(
    private userService: UserService,
    private phoneOptInService: PhoneOptInService,
    private notificationSettingsService: NotificationSettingsService,
    private imagesService: ImagesService,
    private dataSource: DataSource,
  ) {}

  /**
   * Copies auto-extract answers onto the member's profile and notification
   * defaults, then sends the opt-in confirmation to a saved phone number
   * (PhoneOptInService.confirm). A phone number another account holds is
   * skipped, so the member finishes the form without it. Throws on an invalid
   * time zone or an unusable photo before any other side effect.
   */
  async applyProfileAnswers({
    user,
    schema,
    answers,
  }: {
    user: User;
    schema: FormSchema;
    answers: Record<string, unknown>;
  }): Promise<void> {
    const phoneNumber = getFirstAutoExtractAnswer(schema, answers, "phone");
    const preferredReminderTime =
      getFirstAutoExtractAnswer(schema, answers, "timePicker") ??
      getFirstAutoExtractAnswer(schema, answers, "time");
    const timeZone = getFirstAutoExtractAnswer(schema, answers, "timezone");
    // Before the phone number, whose opt-in MMS a rejection cannot take back.
    if (timeZone && !isTimeZoneIdentifier(timeZone)) {
      throw new BadRequestException(`Invalid time zone: ${timeZone}`);
    }

    const photoKey =
      getFirstAutoExtractAnswer(schema, answers, "image") ??
      getFirstAutoExtractAnswer(schema, answers, "file");
    if (photoKey) {
      await updateLive(this.dataSource.manager, {
        target: User,
        id: user.id,
        changes: {
          profilePicture:
            await this.imagesService.profileImageFromUpload(photoKey),
        },
      });
    }

    const city = getFirstAutoExtractAnswer(schema, answers, "city");
    const text = getCheckboxExtractionValue(
      schema,
      answers,
      "textNotifications",
    );
    const profileDescription = getFirstAutoExtractAnswer(
      schema,
      answers,
      "textarea",
    );

    const email = getCheckboxExtractionValue(
      schema,
      answers,
      "emailNotifications",
    );
    if (text !== null || email !== null) {
      await this.notificationSettingsService.update(user.id, {
        defaults: {
          ...(text !== null && { text }),
          ...(email !== null && { email }),
        },
      });
    }

    const userUpdates: Partial<UpdateProfileDto> = {};

    if (phoneNumber) {
      const parsed = toE164(phoneNumber);

      if (R.isFailure(parsed)) {
        this.logger.warn(`Could not parse user ${user.id}'s phone number`);
      } else if (await this.savePhoneNumber(user, parsed.value)) {
        await this.phoneOptInService.confirm(user.id);
      }
    }

    if (city) {
      const parsedCityId = Number.parseInt(city, 10);
      if (Number.isFinite(parsedCityId)) {
        userUpdates.cityId = parsedCityId;
      } else {
        this.logger.warn(`setting custom city from form submission: ${city}`);
        userUpdates.customCityString = city;
      }
    }

    if (preferredReminderTime) {
      const parsedTime = toPlainTime(preferredReminderTime);
      if (parsedTime) {
        userUpdates.preferredReminderTime = parsedTime;
      } else {
        this.logger.warn(
          `Failed to parse preferred reminder time: ${preferredReminderTime}`,
        );
      }
    }

    if (timeZone) {
      userUpdates.timeZone = timeZone;
    }

    if (profileDescription) {
      userUpdates.profileDescription = profileDescription;
    }

    const shareInfoPublicly = getCheckboxExtractionValue(
      schema,
      answers,
      "shareInfoPublicly",
    );
    if (shareInfoPublicly !== null) {
      userUpdates.shareInfoPublicly = shareInfoPublicly;
    }

    if (Object.keys(userUpdates).length > 0) {
      await this.userService.update(user.id, userUpdates);
    }
  }

  /**
   * BACKCOMPAT(phone-verification): saves a form's number without a code;
   * remove once no client older than the code step is in use. Saves first, so
   * a number another live account holds, or takes mid-submission, is skipped
   * before its welcome text goes out.
   */
  private async savePhoneNumber(
    user: User,
    phoneNumber: string,
  ): Promise<boolean> {
    if (phoneNumber === user.phoneNumber) return true;
    try {
      await this.userService.update(user.id, { phoneNumber });
      return true;
    } catch (error) {
      if (!(error instanceof PhoneNumberTakenException)) throw error;
      this.logger.warn(
        `Not saving user ${user.id}'s phone number: another account holds it`,
      );
      return false;
    }
  }
}
