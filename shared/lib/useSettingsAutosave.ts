import { errorMessage } from "@alliance/common/errorMessage";
import {
  asCountryCode,
  DEFAULT_PHONE_COUNTRY,
  phoneNumberCountry,
  type CountryCode,
} from "@alliance/common/phone";
import { useCallback, useMemo, useState } from "react";
import type { UpdateProfileDto } from "../client";
import {
  phoneNumberSettingsError,
  settingsAutosave,
  settingsSavedEditable,
  settingsSaveStatus,
  settingsSaveStatusText,
  type SettingsSaveStatus,
} from "./settings";
import { useSerializedAutosave } from "./useSerializedAutosave";
import { useUpdateProfileMutation } from "./user";

const AUTOSAVE_DEBOUNCE_MS = 250;

export type SettingsAutosaveState = {
  editableUser: UpdateProfileDto | null;
  updateEditableUser: (updates: Partial<UpdateProfileDto>) => void;
  /** Updates editable and saved state atomically, including late city data. */
  setSavedProfile: (
    update:
      | UpdateProfileDto
      | ((previous: UpdateProfileDto | null) => UpdateProfileDto),
  ) => void;
  /** Withheld while the field is focused: mid-entry is not yet a mistake. */
  phoneNumberError: string | null;
  phoneNumberCountry: CountryCode;
  setPhoneNumberCountry: (country: CountryCode) => void;
  /**
   * Tracks focus so mid-edit saves do not move the caret, and so a half-typed
   * number is reported as unsaved rather than as an error to fix.
   */
  setPhoneNumberEditing: (editing: boolean) => void;
  saveStatus: SettingsSaveStatus;
  saveStatusText: string;
  saveError: string | null;
  retrySave: () => void;
};

export function useSettingsAutosave(
  userId: number | undefined,
  /** Fallback when storage and selection provide no country. */
  cityCountryCode?: string | null,
): SettingsAutosaveState {
  const { mutateAsync: updateProfile } = useUpdateProfileMutation(userId);

  const [editableUser, setEditableUser] = useState<UpdateProfileDto | null>(
    null,
  );
  const [initialUser, setInitialUser] = useState<UpdateProfileDto | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<CountryCode | null>(
    null,
  );
  // Focus changes what the member is told, never the derived save plan, so
  // holding it in state cannot restart the autosave debounce.
  const [phoneNumberEditing, setPhoneNumberEditing] = useState(false);

  const country: CountryCode =
    selectedCountry ??
    phoneNumberCountry(initialUser?.phoneNumber) ??
    asCountryCode(cityCountryCode) ??
    DEFAULT_PHONE_COUNTRY;

  const autosave = useMemo(
    () => settingsAutosave(editableUser, initialUser, country),
    [editableUser, initialUser, country],
  );

  const phoneNumberError = useMemo(
    () => phoneNumberSettingsError(editableUser, initialUser, country),
    [editableUser, initialUser, country],
  );

  const { saving, saveError, clearFailure, resetAutosave } =
    useSerializedAutosave({
      candidate: autosave,
      debounceMs: AUTOSAVE_DEBOUNCE_MS,
      save: async (save) => {
        await updateProfile(save.body);
      },
      onSaved: (save) => {
        setInitialUser(save.savedState);
        setEditableUser((previous) =>
          settingsSavedEditable(
            previous,
            save,
            save.country,
            phoneNumberEditing,
          ),
        );
      },
      errorMessage: (error) => {
        console.error("Failed to save settings:", error);
        return errorMessage({
          error,
          fallback: "Your changes couldn't be saved. Please try again.",
        });
      },
    });

  const updateEditableUser = useCallback(
    (updates: Partial<UpdateProfileDto>) => {
      clearFailure();
      setEditableUser((previous) =>
        previous ? { ...previous, ...updates } : previous,
      );
    },
    [clearFailure],
  );

  const setSavedProfile = useCallback(
    (
      update:
        | UpdateProfileDto
        | ((previous: UpdateProfileDto | null) => UpdateProfileDto),
    ) => {
      resetAutosave();
      const next = typeof update === "function" ? update : () => update;
      setEditableUser(next);
      setInitialUser(next);
    },
    [resetAutosave],
  );

  const setPhoneNumberCountry = useCallback(
    (nextCountry: CountryCode) => {
      clearFailure();
      setSelectedCountry(nextCountry);
    },
    [clearFailure],
  );

  const saveStatus = settingsSaveStatus({
    saving,
    saveFailed: saveError !== null,
    pending: autosave !== null,
    blocked: phoneNumberError !== null,
    blockedFieldFocused: phoneNumberEditing,
  });

  return {
    editableUser,
    updateEditableUser,
    setSavedProfile,
    phoneNumberError: phoneNumberEditing ? null : phoneNumberError,
    phoneNumberCountry: country,
    setPhoneNumberCountry,
    setPhoneNumberEditing,
    saveStatus,
    saveStatusText: settingsSaveStatusText(saveStatus),
    saveError,
    retrySave: clearFailure,
  };
}
