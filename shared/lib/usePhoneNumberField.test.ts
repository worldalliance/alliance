import type { CountryCode } from "@alliance/common/phone";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useState } from "react";
import {
  usePhoneFieldCountry,
  usePhoneNumberField,
  type PhoneNumberFieldState,
} from "./usePhoneNumberField";

type HarnessApi = PhoneNumberFieldState & {
  value: string;
  country: CountryCode;
};

function mountField(stored: string, storedCountry: CountryCode = "US") {
  const changes: string[] = [];
  const editingEvents: boolean[] = [];

  const view = renderHook((): HarnessApi => {
    const [value, setValue] = useState(stored);
    const [country, setCountry] = useState(storedCountry);

    const field = usePhoneNumberField({
      value,
      onChange: (next) => {
        changes.push(next);
        setValue(next);
      },
      country,
      onCountryChange: setCountry,
      onEditingChange: (editing) => editingEvents.push(editing),
    });

    return { ...field, value, country };
  });

  return {
    changes,
    editingEvents,
    get field() {
      return view.result.current;
    },
    act: (run: (field: HarnessApi) => void) =>
      act(() => run(view.result.current)),
  };
}

afterEach(cleanup);

describe("usePhoneNumberField", () => {
  it("shows digits while focused and the readable form once blurred", () => {
    const field = mountField("+14155552671");

    expect(field.field.displayValue).toBe("(415) 555-2671");

    field.act((f) => f.beginEditing());
    expect(field.field.displayValue).toBe("4155552671");
    expect(field.field.editing).toBe(true);

    field.act((f) => f.endEditing());
    expect(field.field.displayValue).toBe("(415) 555-2671");
    expect(field.field.editing).toBe(false);
  });

  it("does not touch the stored number when the field is focused", () => {
    // The separator-free spelling is display state; writing it back would
    // strip `+44` off a number the member never even edited.
    const field = mountField("+442079460958", "GB");

    field.act((f) => f.beginEditing());

    expect(field.field.displayValue).toBe("02079460958");
    expect(field.field.value).toBe("+442079460958");
    expect(field.changes).toEqual([]);
  });

  it("keeps a non-US number canonical when the field never blurs", () => {
    // A draft persisted mid-edit must still hold something `toE164` can read.
    const field = mountField("+442079460958", "GB");

    field.act((f) => f.beginEditing());
    field.act((f) => f.changeText("020 7946 0958"));

    expect(field.field.value).toBe("+442079460958");
  });

  it("stores E.164 as soon as the number parses, without waiting for blur", () => {
    const field = mountField("");

    field.act((f) => f.beginEditing());
    field.act((f) => f.changeText("415"));
    expect(field.field.value).toBe("415");

    field.act((f) => f.changeText("4155552671"));
    expect(field.field.value).toBe("+14155552671");
    expect(field.field.displayValue).toBe("4155552671");
  });

  it("leaves a half-typed number as typed so validation can flag it", () => {
    const field = mountField("");

    field.act((f) => f.beginEditing());
    field.act((f) => f.changeText("(415) 555"));

    expect(field.field.value).toBe("415555");
  });

  it("re-reads the typed number when the country is corrected", () => {
    // A GB national number typed under +1 cannot resolve on its own; picking
    // the country is what turns it into E.164.
    const field = mountField("02079460958");

    expect(field.field.value).toBe("02079460958");

    field.act((f) => f.changeCountry("GB"));

    expect(field.field.value).toBe("+442079460958");
    expect(field.field.country).toBe("GB");
    expect(field.field.displayValue).toBe("020 7946 0958");
  });

  it("does not rewrite an already-international number on a country change", () => {
    const field = mountField("+442079460958", "GB");

    field.act((f) => f.changeCountry("FR"));

    expect(field.field.value).toBe("+442079460958");
    expect(field.changes).toEqual([]);
  });

  it("follows a NANP area code into its own country", () => {
    const field = mountField("");

    field.act((f) => f.beginEditing());
    field.act((f) => f.changeText("4165551234"));

    expect(field.field.country).toBe("CA");
    expect(field.field.value).toBe("+14165551234");
  });

  it("reports focus so callers can hold off on rewriting the value", () => {
    const field = mountField("+14155552671");

    field.act((f) => f.beginEditing());
    field.act((f) => f.endEditing());

    expect(field.editingEvents).toEqual([true, false]);
  });

  it("treats an empty field as editable rather than unfocused", () => {
    const field = mountField("");

    field.act((f) => f.beginEditing());

    expect(field.field.displayValue).toBe("");
    expect(field.field.editing).toBe(true);
  });
});

/** Models a form field whose answer is applied by an effect after mount. */
function mountCountry(initial: string) {
  const view = renderHook(
    ({ answer }) => {
      const [country, setCountry] = usePhoneFieldCountry(answer);
      return { country, setCountry };
    },
    { initialProps: { answer: initial } },
  );

  return {
    get country() {
      return view.result.current.country;
    },
    pick: (country: CountryCode) =>
      act(() => view.result.current.setCountry(country)),
    load: (answer: string) => view.rerender({ answer }),
  };
}

describe("usePhoneFieldCountry", () => {
  it("adopts the country of an answer that arrives after mount", () => {
    // The regression: form drafts are applied in an effect, so the first
    // render sees "" and the selector used to stay stuck on the default.
    const field = mountCountry("");

    expect(field.country).toBe("US");

    field.load("+447578497969");

    expect(field.country).toBe("GB");
  });

  it("reads the country off an answer that is there from the start", () => {
    expect(mountCountry("+33751181445").country).toBe("FR");
  });

  it("falls back to the default when there is no answer to read", () => {
    expect(mountCountry("").country).toBe("US");
  });

  it("keeps the country the member picked by hand", () => {
    const field = mountCountry("");

    field.pick("GB");

    expect(field.country).toBe("GB");
  });

  it("does not re-read a national number under the picked country", () => {
    // "4155552671" is a valid US number, but the member said GB. Resolving it
    // against the default region would silently undo that.
    const field = mountCountry("");
    field.pick("GB");

    field.load("4155552671");

    expect(field.country).toBe("GB");
  });

  it("leaves a half-typed number alone rather than guessing", () => {
    const field = mountCountry("");

    for (const partial of ["4", "415", "41555"]) {
      field.load(partial);
      expect(field.country).toBe("US");
    }
  });

  it("ignores an answer it cannot parse", () => {
    const field = mountCountry("");

    field.load("+000");

    expect(field.country).toBe("US");
  });
});
