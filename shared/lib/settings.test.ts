import { phoneNumberForEditing } from "@alliance/common/phone";
import type { UpdateProfileDto } from "../client";
import {
  phoneNumberSettingsError,
  settingsAutosave,
  settingsSavedEditable,
  settingsSaveStatus,
} from "./settings";

const saved: UpdateProfileDto = {
  name: "Ada",
  phoneNumber: "+14155552671",
  timeZone: "America/Los_Angeles",
};

const edit = (changes: Partial<UpdateProfileDto>): UpdateProfileDto => ({
  ...saved,
  ...changes,
});

describe("settingsAutosave", () => {
  it("has nothing to send when nothing changed", () => {
    expect(settingsAutosave(edit({}), saved, "US")).toBeNull();
  });

  it("sends an edited field", () => {
    const result = settingsAutosave(edit({ name: "Grace" }), saved, "US");

    expect(result?.body).toEqual({ name: "Grace" });
    expect(result?.savedState.name).toBe("Grace");
  });

  it("sends a valid phone number as E.164, and null when blank", () => {
    expect(
      settingsAutosave(edit({ phoneNumber: "(415) 555-2672" }), saved, "US")
        ?.body.phoneNumber,
    ).toBe("+14155552672");
    expect(
      settingsAutosave(edit({ phoneNumber: "   " }), saved, "US")?.body
        .phoneNumber,
    ).toBeNull();
  });

  it("has nothing to send when the number is only respelled", () => {
    expect(
      settingsAutosave(edit({ phoneNumber: "(415) 555-2671" }), saved, "US"),
    ).toBeNull();
  });

  it("leaves an untouched number out of the payload entirely", () => {
    const legacy: UpdateProfileDto = { ...saved, phoneNumber: "555-12" };
    const result = settingsAutosave({ ...legacy, name: "Grace" }, legacy, "US");

    expect(result).not.toBeNull();
    expect(result?.body).not.toHaveProperty("phoneNumber");
    expect(result?.savedState.phoneNumber).toBe("555-12");
  });

  it("still saves every other field while the number is half-typed", () => {
    const result = settingsAutosave(
      edit({ phoneNumber: "415555", timeZone: "America/New_York" }),
      saved,
      "US",
    );

    expect(result?.body.timeZone).toBe("America/New_York");
    expect(result?.body).toEqual({ timeZone: "America/New_York" });
    expect(result?.body).not.toHaveProperty("phoneNumber");
  });

  it("keeps a half-typed number marked as edited, and terminates", () => {
    const editable = edit({ phoneNumber: "415555", name: "Grace" });
    const first = settingsAutosave(editable, saved, "US");

    expect(first?.savedState.phoneNumber).toBe("+14155552671");
    expect(settingsAutosave(editable, first!.savedState, "US")).toBeNull();

    const corrected = { ...editable, phoneNumber: "(415) 555-2672" };
    expect(
      settingsAutosave(corrected, first!.savedState, "US")?.body.phoneNumber,
    ).toBe("+14155552672");
  });

  it("does not save when only an object field's identity changed", () => {
    const withRanges = { ...saved, awayRanges: [{ start: "2026-01-01" }] };
    const reloaded = { ...withRanges, awayRanges: [{ start: "2026-01-01" }] };

    expect(settingsAutosave(reloaded, withRanges, "US")).toBeNull();
  });

  it("treats a blank field and no number on file as the same state", () => {
    const none: UpdateProfileDto = { ...saved, phoneNumber: null };

    expect(
      settingsAutosave({ ...none, phoneNumber: "" }, none, "US"),
    ).toBeNull();
  });
});

describe("settingsSavedEditable", () => {
  const afterSaving = (typed: string, from = saved) => {
    const save = settingsAutosave({ ...from, phoneNumber: typed }, from, "US");
    expect(save).not.toBeNull();
    return settingsSavedEditable(
      { ...from, phoneNumber: typed },
      save!,
      "US",
      false,
    )?.phoneNumber;
  };

  it("puts the stored form back in the field", () => {
    expect(afterSaving("(415) 555-2672")).toBe("+14155552672");
  });

  it("shows a number read as the wrong country", () => {
    expect(afterSaving("55 1234 5678")).toBe("+15512345678");
  });

  it("leaves a field that was typed into while the save was in flight", () => {
    const save = settingsAutosave(
      edit({ phoneNumber: "(415) 555-2672" }),
      saved,
      "US",
    );

    expect(
      settingsSavedEditable(
        edit({ phoneNumber: "(415) 555-267" }),
        save!,
        "US",
        false,
      )?.phoneNumber,
    ).toBe("(415) 555-267");
  });

  it("leaves a half-typed number the save deliberately held back", () => {
    const editable = edit({ phoneNumber: "415555", name: "Grace" });
    const save = settingsAutosave(editable, saved, "US");

    expect(
      settingsSavedEditable(editable, save!, "US", false)?.phoneNumber,
    ).toBe("415555");
  });

  it("does not touch the state when there is nothing to rewrite", () => {
    const editable = edit({ name: "Grace" });
    const save = settingsAutosave(editable, saved, "US");

    expect(settingsSavedEditable(editable, save!, "US", false)).toBe(editable);
  });

  it("leaves the field alone while the member is still in it", () => {
    const editable = edit({ phoneNumber: "4155552672" });
    const save = settingsAutosave(editable, saved, "US");

    expect(save?.body.phoneNumber).toBe("+14155552672");
    expect(settingsSavedEditable(editable, save!, "US", true)).toBe(editable);
  });

  it("still rewrites once the field is left", () => {
    const editable = edit({ phoneNumber: "4155552672" });
    const save = settingsAutosave(editable, saved, "US");

    expect(
      settingsSavedEditable(editable, save!, "US", false)?.phoneNumber,
    ).toBe("+14155552672");
  });
});

describe("phoneNumberSettingsError", () => {
  it("does not flag a number that has not been edited", () => {
    const legacy: UpdateProfileDto = { ...saved, phoneNumber: "555-12" };

    expect(phoneNumberSettingsError(legacy, legacy, "US")).toBeNull();
  });

  it("survives the field being focused and left alone", () => {
    for (const onFile of ["555-12", "+14155552671", null]) {
      const legacy: UpdateProfileDto = { ...saved, phoneNumber: onFile };
      const focused = {
        ...legacy,
        phoneNumber: phoneNumberForEditing(onFile ?? "", "US"),
      };

      expect(phoneNumberSettingsError(focused, legacy, "US")).toBeNull();
      expect(settingsAutosave(focused, legacy, "US")).toBeNull();
    }
  });

  it("does not flag a cleared field", () => {
    expect(
      phoneNumberSettingsError(edit({ phoneNumber: "" }), saved, "US"),
    ).toBeNull();
  });

  it("flags an edited number that cannot be parsed", () => {
    expect(
      phoneNumberSettingsError(edit({ phoneNumber: "415555" }), saved, "US"),
    ).toBe("Enter a valid phone number");
  });
});

describe("settingsSaveStatus", () => {
  const status = (state: Partial<Parameters<typeof settingsSaveStatus>[0]>) =>
    settingsSaveStatus({
      saving: false,
      saveFailed: false,
      pending: false,
      blocked: false,
      blockedFieldFocused: false,
      ...state,
    });

  it("reports the field error once everything sendable has gone", () => {
    expect(status({ blocked: true })).toBe("blocked");
  });

  it("waits until the member leaves the field to call it an error", () => {
    expect(status({ blocked: true, blockedFieldFocused: true })).toBe(
      "unsaved",
    );
  });

  it("reports the error as soon as the field is left", () => {
    expect(status({ blocked: true, blockedFieldFocused: false })).toBe(
      "blocked",
    );
  });

  it("says nothing about a focused field that is not blocking anything", () => {
    expect(status({ blockedFieldFocused: true })).toBe("saved");
  });

  it("still reports an in-flight or rejected save over a focused field", () => {
    expect(
      status({ saving: true, blocked: true, blockedFieldFocused: true }),
    ).toBe("saving");
    expect(
      status({ saveFailed: true, blocked: true, blockedFieldFocused: true }),
    ).toBe("failed");
  });

  it("reports outstanding changes ahead of the field error", () => {
    expect(status({ pending: true, blocked: true })).toBe("unsaved");
  });

  it("reports a rejected save ahead of everything but an in-flight one", () => {
    expect(status({ saveFailed: true, pending: true })).toBe("failed");
    expect(status({ saving: true, saveFailed: true })).toBe("saving");
  });

  it("reports all saved when there is nothing outstanding", () => {
    expect(status({})).toBe("saved");
  });
});

describe("the selected country", () => {
  const saved: UpdateProfileDto = { name: "Ada", phoneNumber: null };

  it("sends a national number as the country the member picked", () => {
    const typed = { ...saved, phoneNumber: "07578 497969" };

    expect(settingsAutosave(typed, saved, "GB")?.body.phoneNumber).toBe(
      "+447578497969",
    );
    expect(phoneNumberSettingsError(typed, saved, "GB")).toBeNull();
    expect(phoneNumberSettingsError(typed, saved, "US")).toBe(
      "Enter a valid phone number",
    );
  });

  it("changes what an unchanged number means", () => {
    const typed = { ...saved, phoneNumber: "5512345678" };

    expect(settingsAutosave(typed, saved, "US")?.body.phoneNumber).toBe(
      "+15512345678",
    );
    expect(settingsAutosave(typed, saved, "MX")?.body.phoneNumber).toBe(
      "+525512345678",
    );
  });

  it("lets a pasted international number override the selection", () => {
    const typed = { ...saved, phoneNumber: "+447578497969" };

    expect(settingsAutosave(typed, saved, "US")?.body.phoneNumber).toBe(
      "+447578497969",
    );
  });

  it("still has nothing to send when a stored number is only respelled", () => {
    const onFile: UpdateProfileDto = {
      name: "Ada",
      phoneNumber: "+447578497969",
    };

    expect(settingsAutosave({ ...onFile }, onFile, "GB")).toBeNull();
    expect(
      settingsAutosave(
        { ...onFile, phoneNumber: "07578 497969" },
        onFile,
        "GB",
      ),
    ).toBeNull();
  });
});
