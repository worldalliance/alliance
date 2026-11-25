import { renderHook } from "@testing-library/react";
import {
  listField,
  schemaWith,
  textField,
} from "../lib/testing/formVisibility";
import { useFormSchemaMaps } from "./useFormSchemaMaps";

describe("useFormSchemaMaps", () => {
  it("looks up list sub-fields, so a condition can reference one", () => {
    const schema = schemaWith([
      listField("addresses", [textField("street"), textField("city")]),
    ]);
    const { result } = renderHook(() =>
      useFormSchemaMaps({
        schema,
        userDefaultPublic: false,
        timeZone: "UTC",
        profilePhoneNumber: null,
      }),
    );

    expect(result.current.fieldLookup.has("addresses")).toBe(true);
    expect(result.current.fieldLookup.get("street")?.id).toBe("street");
    expect(result.current.fieldLookup.get("city")?.id).toBe("city");
  });

  it("defaults an output field to the user's preference unless it is private", () => {
    const schema = schemaWith([
      { ...textField("shared"), output: { output: true } },
      {
        ...textField("secret"),
        output: { output: true, privateByDefault: true },
      },
      textField("notOutput"),
    ]);

    const { result } = renderHook(() =>
      useFormSchemaMaps({
        schema,
        userDefaultPublic: true,
        timeZone: "UTC",
        profilePhoneNumber: null,
      }),
    );

    expect(result.current.outputFieldDefaultPublic.get("shared")).toBe(true);
    expect(result.current.outputFieldDefaultPublic.get("secret")).toBe(false);
    expect(result.current.outputFieldIds.has("notOutput")).toBe(false);
  });

  it("seeds a timezone field with the given zone over the field's own default", () => {
    const schema = schemaWith([
      {
        id: "fixed",
        type: "input",
        kind: "timezone",
        label: "fixed",
        defaultValue: "America/Los_Angeles",
      },
      {
        id: "empty",
        type: "input",
        kind: "timezone",
        label: "empty",
        defaultValue: null,
      },
    ]);
    const initialProps: { timeZone: string | undefined } = {
      timeZone: "Asia/Kolkata",
    };
    const { result, rerender } = renderHook(
      ({ timeZone }) =>
        useFormSchemaMaps({
          schema,
          userDefaultPublic: false,
          timeZone,
          profilePhoneNumber: null,
        }),
      { initialProps },
    );

    expect(Object.fromEntries(result.current.defaultValueMap)).toEqual({
      fixed: "Asia/Kolkata",
      empty: "Asia/Kolkata",
    });

    rerender({ timeZone: "Europe/Paris" });
    expect(result.current.defaultValueMap.get("fixed")).toBe("Europe/Paris");

    rerender({ timeZone: undefined });
    expect(result.current.defaultValueMap.size).toBe(0);
  });

  it("seeds a phone field that fills the profile with the member's number", () => {
    const schema = schemaWith([
      {
        id: "profile",
        type: "input",
        kind: "phone",
        label: "profile",
        autoExtractUserData: true,
        defaultValue: "+14155550100",
      },
      { id: "other", type: "input", kind: "phone", label: "other" },
    ]);
    const initialProps: { profilePhoneNumber: string | null } = {
      profilePhoneNumber: "+14155552671",
    };
    const { result, rerender } = renderHook(
      ({ profilePhoneNumber }) =>
        useFormSchemaMaps({
          schema,
          userDefaultPublic: false,
          timeZone: "UTC",
          profilePhoneNumber,
        }),
      { initialProps },
    );

    expect(Object.fromEntries(result.current.defaultValueMap)).toEqual({
      profile: "+14155552671",
    });

    rerender({ profilePhoneNumber: null });
    expect(result.current.defaultValueMap.get("profile")).toBe("+14155550100");
  });

  it("reports the page bounds", () => {
    const { result } = renderHook(() =>
      useFormSchemaMaps({
        schema: { pages: [{ id: "a", fields: [] }], outputViews: [] },
        userDefaultPublic: false,
        timeZone: "UTC",
        profilePhoneNumber: null,
      }),
    );
    expect(result.current.pageCount).toBe(1);
    expect(result.current.maxPageIndex).toBe(0);
  });
});
