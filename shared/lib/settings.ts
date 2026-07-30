import {
  type CountryCode,
  normalizePhoneNumber,
  type PhoneNumberError,
  toE164,
} from "@alliance/common/phone";
import { R } from "@alliance/common/result";
import { isEqual, pickBy } from "es-toolkit";
import type {
  NotificationChannel,
  PublicFormResponseDefault,
  UpdateProfileDto,
} from "../client";

export type NotificationChannelOption = {
  value: NotificationChannel;
  label: string;
};

export type FormDataPreferenceOption = {
  value: PublicFormResponseDefault;
  label: string;
};

export const FORM_DATA_PREFERENCE_OPTIONS: FormDataPreferenceOption[] = [
  { value: "public", label: "Default to visible" },
  { value: "private", label: "Default to hidden" },
];

/** Compares storage forms, treating equivalent spellings and blank/null alike. */
function isPhoneNumberEdited(
  editableUser: UpdateProfileDto | null,
  initialUser: UpdateProfileDto | null,
  country: CountryCode,
): boolean {
  if (!editableUser || !initialUser) {
    return false;
  }
  return (
    phoneNumberToStore(editableUser.phoneNumber, country) !==
    phoneNumberToStore(initialUser.phoneNumber, country)
  );
}

/** Returns E.164/null while preserving invalid edits. */
function phoneNumberToStore(
  phoneNumber: string | null | undefined,
  country: CountryCode,
): string | null {
  const trimmed = phoneNumber?.trim();
  if (!trimmed) {
    return null;
  }
  return normalizePhoneNumber(trimmed, country);
}

const PHONE_NUMBER_ERROR_COPY: Record<PhoneNumberError, string> = {
  empty: "Enter a phone number",
  invalid: "Enter a valid phone number",
};

/** Validates edited nonblank numbers but allows untouched legacy values. */
export function phoneNumberSettingsError(
  editableUser: UpdateProfileDto | null,
  initialUser: UpdateProfileDto | null,
  country: CountryCode,
): string | null {
  const entered = editableUser?.phoneNumber?.trim();
  if (!isPhoneNumberEdited(editableUser, initialUser, country) || !entered) {
    return null;
  }

  const parsed = toE164(entered, country);
  return R.isFailure(parsed) ? PHONE_NUMBER_ERROR_COPY[parsed.error] : null;
}

function settingsSavePayload(
  payload: UpdateProfileDto,
  sendPhoneNumber: boolean,
  country: CountryCode,
): UpdateProfileDto {
  if (!sendPhoneNumber) {
    const { phoneNumber: _phoneNumber, ...withoutPhoneNumber } = payload;
    return withoutPhoneNumber;
  }
  return {
    ...payload,
    phoneNumber: phoneNumberToStore(payload.phoneNumber, country),
  };
}

export type SettingsAutosave = {
  body: UpdateProfileDto;
  savedState: UpdateProfileDto;
  /** Country captured so acknowledgement uses the same parsing context. */
  country: CountryCode;
};

/** Withholds invalid phone input while advancing other saved fields. */
export function settingsAutosave(
  editableUser: UpdateProfileDto | null,
  initialUser: UpdateProfileDto | null,
  country: CountryCode,
): SettingsAutosave | null {
  if (!editableUser || !initialUser) {
    return null;
  }

  const sendPhoneNumber =
    isPhoneNumberEdited(editableUser, initialUser, country) &&
    phoneNumberSettingsError(editableUser, initialUser, country) === null;

  const normalized = settingsSavePayload(
    editableUser,
    sendPhoneNumber,
    country,
  );
  const body = pickBy(
    normalized,
    (value, key) => !isEqual(value, initialUser[key]),
  );
  if (Object.keys(body).length === 0) {
    return null;
  }

  return {
    body,
    savedState: {
      ...editableUser,
      phoneNumber: sendPhoneNumber ? body.phoneNumber : initialUser.phoneNumber,
    },
    country,
  };
}

/** Applies saved normalization unless the phone changed mid-save or is focused. */
export function settingsSavedEditable(
  current: UpdateProfileDto | null,
  save: SettingsAutosave,
  country: CountryCode,
  phoneNumberEditing: boolean,
): UpdateProfileDto | null {
  const stored = save.savedState.phoneNumber ?? null;
  if (!current || phoneNumberEditing || current.phoneNumber === stored) {
    return current;
  }
  return phoneNumberToStore(current.phoneNumber, country) === stored
    ? { ...current, phoneNumber: stored }
    : current;
}

export type SettingsSaveStatus =
  | "saving"
  | "failed"
  | "blocked"
  | "unsaved"
  | "saved";

const SETTINGS_SAVE_STATUS_COPY: Record<SettingsSaveStatus, string> = {
  saving: "Saving...",
  failed: "Couldn't save changes",
  blocked: "Fix the errors to save",
  unsaved: "Unsaved changes",
  saved: "All changes saved",
};

export function settingsSaveStatus(state: {
  saving: boolean;
  saveFailed: boolean;
  pending: boolean;
  blocked: boolean;
  /**
   * Whether the member is still in the field holding the save back. Mid-entry
   * that edit is simply unsaved; reporting it as an error to fix would scold
   * them for a number they are only halfway through typing.
   */
  blockedFieldFocused: boolean;
}): SettingsSaveStatus {
  if (state.saving) {
    return "saving";
  }
  if (state.saveFailed) {
    return "failed";
  }
  if (state.pending) {
    return "unsaved";
  }
  if (state.blocked) {
    return state.blockedFieldFocused ? "unsaved" : "blocked";
  }
  return "saved";
}

export function settingsSaveStatusText(status: SettingsSaveStatus): string {
  return SETTINGS_SAVE_STATUS_COPY[status];
}

/**
 * Helper to create a partial update for the user profile.
 */
export function updateEditableUserField<K extends keyof UpdateProfileDto>(
  prev: UpdateProfileDto | null,
  key: K,
  value: UpdateProfileDto[K],
): UpdateProfileDto | null {
  if (!prev) return prev;
  return { ...prev, [key]: value };
}
