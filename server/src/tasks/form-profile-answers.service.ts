import {
  type CheckboxExtractionTarget,
  type CheckboxField,
  type CityFieldValue,
  type CustomComponentField,
  FormSchema,
} from "@alliance/common/forms/form-schema";
import { toE164 } from "@alliance/common/phone";
import { R } from "@alliance/common/result";
import { isTimeZoneIdentifier } from "@alliance/common/timezone";
import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { EventType } from "src/eventlog/event-log.entity";
import { EventLogService } from "src/eventlog/eventlog.service";
import { MmsService } from "src/mms/mms.service";
import { welcomeMessage } from "src/notifs/textnotifcontents";
import { UpdateProfileDto } from "src/user/dto/user.dto";
import { User } from "src/user/entities/user.entity";
import { UserService } from "src/user/user.service";
import { toPlainTime } from "src/utils/plain-time";

function getFirstAutoExtractAnswer(
  schema: FormSchema,
  answers: Record<string, unknown>,
  kind: "phone" | "time" | "timezone" | "city",
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
      if (field.kind !== "checkbox" && field.kind !== "custom") {
        continue;
      }
      const extractField = field as CheckboxField | CustomComponentField;
      if (extractField.autoExtractUserData?.target !== target) {
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
      // Field wasn't answered - don't overwrite existing user setting
      return null;
    }
  }

  return null;
}

@Injectable()
export class FormProfileAnswersService {
  private readonly logger = new Logger(FormProfileAnswersService.name);
  constructor(
    private userService: UserService,
    private mmsService: MmsService,
    private eventLogService: EventLogService,
  ) {}

  /**
   * Copies auto-extract answers onto the member's profile, texting the welcome
   * MMS to the extracted phone number if the member has not opted in. Throws
   * on an invalid time zone before any side effect.
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
    const preferredReminderTime = getFirstAutoExtractAnswer(
      schema,
      answers,
      "time",
    );
    const timeZone = getFirstAutoExtractAnswer(schema, answers, "timezone");
    // Before the phone number, whose opt-in MMS a rejection cannot take back.
    if (timeZone && !isTimeZoneIdentifier(timeZone)) {
      throw new BadRequestException(`Invalid time zone: ${timeZone}`);
    }

    const city = getFirstAutoExtractAnswer(schema, answers, "city");

    const userUpdates: Partial<UpdateProfileDto> = {};

    if (phoneNumber) {
      this.logger.log(`Extracted phone number: ${phoneNumber}`);
      const parsed = toE164(phoneNumber);

      if (R.isFailure(parsed)) {
        this.logger.warn(`Could not parse phone number: ${phoneNumber}`);
      } else {
        const normalized = parsed.value;
        this.logger.log(`Valid phone number: ${normalized}`);
        userUpdates.phoneNumber = normalized;

        if (!user.optInMms) {
          const mms = await this.mmsService.sendMms({
            to: normalized,
            userId: user.id,
            body: welcomeMessage,
            mediaUrls: [],
            tracking: null,
          });
          if (mms) {
            await this.userService.setOptInMms(user.id, mms.id);
          } else {
            if (process.env.NODE_ENV === "production") {
              await this.eventLogService.sendMessage({
                type: EventType.SmsFailure,
                message: `Failed to send opt-in MMS to ${normalized}`,
                userId: user.id,
                blob: { to: normalized },
              });
            }
          }
        }
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
}
